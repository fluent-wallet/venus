import ArrowRight from '@assets/icons/arrow-right2.svg';
import ProhibitIcon from '@assets/icons/prohibit.svg';
import RocketIcon from '@assets/icons/rocket.svg';
import WarnIcon from '@assets/icons/warn.svg';
import {
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetRoute,
  BottomSheetWrapper,
} from '@components/BottomSheet';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { AssetType } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import useInAsync from '@hooks/useInAsync';
import HardwareSignVerify from '@pages/SendTransaction/HardwareSignVerify';
import { useHardwareSigningUiState } from '@pages/SendTransaction/Step4Confirm/useHardwareSigningUiState';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { SpeedUpStackName, StackNavigation, StackScreenProps } from '@router/configs';
import { useAssetsOfAddress } from '@service/asset';
import { getAssetsSyncService } from '@service/core';
import { usePollingGasEstimateAndNonce, useSpeedUpTx, useSpeedUpTxContext } from '@service/transaction';
import backToHome from '@utils/backToHome';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import Decimal from 'decimal.js';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { type AdvanceSetting, GasOption, type GasSetting, type SpeedUpLevel } from '../GasFeeSetting';
import CustomizeAdvanceSetting from '../GasFeeSetting/CustomizeAdvanceSetting';
import CustomizeGasSetting from '../GasFeeSetting/CustomizeGasSetting';

const higherRatio = 1.1;
const fasterRatio = 1.2;

const isUserCanceledError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === AUTH_PASSWORD_REQUEST_CANCELED) return true;
  if (code === 'CANCEL') return true;

  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'AbortError') return true;

  return false;
};

const getErrorText = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybe = error as { data?: unknown; message?: unknown };
    if (typeof maybe.data === 'string') return maybe.data;
    if (typeof maybe.message === 'string') return maybe.message;
  }
  return String(error);
};

type SpeedUpTxPayloadLike = {
  gasPrice?: string | null;
  maxFeePerGas?: string | null;
};

const createGasSetting = (txPayload: SpeedUpTxPayloadLike | null, ratio: number, currentGasPrice: string | null) => {
  if (!txPayload || !currentGasPrice) return null;
  if (txPayload.maxFeePerGas) {
    let suggestedMaxFeePerGas = new Decimal(txPayload.maxFeePerGas || 0).mul(ratio);
    if (suggestedMaxFeePerGas.lessThanOrEqualTo(currentGasPrice)) {
      suggestedMaxFeePerGas = new Decimal(currentGasPrice || 0).mul(ratio);
    }
    return {
      suggestedMaxFeePerGas: suggestedMaxFeePerGas.toHex(),
      suggestedMaxPriorityFeePerGas: suggestedMaxFeePerGas.toHex(),
    };
  }
  let suggestedGasPrice = new Decimal(txPayload.gasPrice || 0).mul(ratio);
  if (suggestedGasPrice.lessThanOrEqualTo(currentGasPrice)) {
    suggestedGasPrice = new Decimal(currentGasPrice || 0).mul(ratio);
  }
  return {
    suggestedGasPrice: suggestedGasPrice.toHex(),
  };
};

const SpeedUp: React.FC<StackScreenProps<typeof SpeedUpStackName>> = ({ navigation, route }) => {
  const { txId, type, level: defaultLevel } = route.params;
  const isSpeedUp = type === 'SpeedUp';
  const { colors } = useTheme();
  const { t } = useTranslation();
  const rootNavigation = useNavigation<StackNavigation>();
  const { data: ctx } = useSpeedUpTxContext(txId);
  const speedUpTx = useSpeedUpTx();

  const addressId = ctx?.addressId ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);
  const abortRef = useRef<AbortController | null>(null);

  const { data: assets } = useAssetsOfAddress(addressId);
  const nativeAsset = useMemo(() => assets?.find((a) => String(a.type) === 'Native') ?? null, [assets]);

  const txStatus = ctx?.status ?? null;

  const txHalf = useMemo(() => {
    if (!ctx?.payload?.from) return null;
    const from = ctx.payload.from;
    if (isSpeedUp) {
      return {
        from,
        to: ctx.payload.to || from,
        value: ctx.payload.value || '0x0',
        data: ctx.payload.data || '0x',
      };
    }
    return {
      from,
      to: from,
      value: '0x0',
      data: '0x',
    };
  }, [ctx, isSpeedUp]);

  const [error, setError] = useState<{ type?: string; message: string } | null>(null);

  const estimateRes = usePollingGasEstimateAndNonce(txHalf, true, addressId);
  const estimateCurrentGasPrice = estimateRes?.gasPrice ?? null;

  const higherGasSetting = useMemo(() => createGasSetting(ctx?.payload ?? null, higherRatio, estimateCurrentGasPrice), [ctx?.payload, estimateCurrentGasPrice]);
  const fasterGasSetting = useMemo(() => createGasSetting(ctx?.payload ?? null, fasterRatio, estimateCurrentGasPrice), [ctx?.payload, estimateCurrentGasPrice]);
  const [customizeGasSetting, setCustomizeGasSetting] = useState<GasSetting | null>(null);
  const [showCustomizeSetting, setShowCustomizeSetting] = useState(false);
  const [showCustomizeAdvanceSetting, setShowCustomizeAdvanceSetting] = useState(false);
  const [customizeAdvanceSetting, setCustomizeAdvanceSetting] = useState<AdvanceSetting | null>(null);

  useEffect(() => {
    if (customizeGasSetting === null && fasterGasSetting && higherGasSetting) {
      setCustomizeGasSetting(defaultLevel === 'faster' ? fasterGasSetting : higherGasSetting);
    }
  }, [fasterGasSetting, higherGasSetting, defaultLevel, customizeGasSetting]);

  const [tempSelectedOptionLevel, setTempSelectedOptionLevel] = useState<SpeedUpLevel | undefined>(defaultLevel);
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const handleTxExpire = useCallback(() => {
    if (txStatus && txStatus !== 'pending') {
      bottomSheetRef.current?.close();
      showMessage({
        type: 'warning',
        message: t('tx.action.expiredTitle'),
        description: txStatus === 'confirmed' ? t('tx.action.alreadyExecuted') : t('tx.action.alreadyFailed'),
      });
    }
  }, [txStatus, t]);

  useEffect(() => {
    handleTxExpire();
  }, [handleTxExpire]);

  const newGasSetting =
    tempSelectedOptionLevel === 'customize' ? customizeGasSetting : tempSelectedOptionLevel === 'faster' ? fasterGasSetting : higherGasSetting;

  const _handleSend = useCallback(async () => {
    if (!ctx || !newGasSetting || !txHalf || !estimateRes) return;

    if (ctx.isHardwareWallet && ctx.networkType === NetworkType.Conflux) {
      showMessage({
        message: 'BSIM not support Conflux Core',
        type: 'warning',
      });
      return;
    }

    setError(null);

    abortRef.current?.abort();
    const controller = ctx.isHardwareWallet ? new AbortController() : null;
    abortRef.current = controller;
    clearHardwareSignState();

    try {
      const gasLimit = customizeAdvanceSetting?.gasLimit ?? estimateRes.gasLimit;
      const storageLimit = customizeAdvanceSetting?.storageLimit ?? estimateRes.storageLimit;

      const action = type === 'Cancel' ? 'Cancel' : 'SpeedUp';
      const feeOverrides = newGasSetting.suggestedMaxFeePerGas
        ? {
            maxFeePerGas: newGasSetting.suggestedMaxFeePerGas,
            maxPriorityFeePerGas: newGasSetting.suggestedMaxPriorityFeePerGas!,
          }
        : { gasPrice: newGasSetting.suggestedGasPrice! };

      await speedUpTx({
        txId,
        action,
        feeOverrides,
        advanceOverrides: { gasLimit, storageLimit: storageLimit ?? undefined },
        nonce: ctx.payload.nonce,
        signal: controller?.signal,
      });

      showMessage({
        type: 'success',
        message: t('tx.confirm.submitted.message'),
        description: t('tx.confirm.submitted.description'),
        icon: 'loading' as unknown as undefined,
      });

      backToHome(navigation);

      try {
        void getAssetsSyncService().refreshCurrent({ reason: 'manual' });
      } catch {
        //
      }
    } catch (_err: unknown) {
      if (controller?.signal.aborted) {
        clearHardwareSignState();
        return;
      }

      if (
        handleBSIMHardwareUnavailable(_err, rootNavigation, {
          beforeNavigate: () => {
            clearHardwareSignState();
            abortRef.current?.abort();
          },
        })
      ) {
        return;
      }

      if (isUserCanceledError(_err)) {
        clearHardwareSignState();
        return;
      }

      const err = getErrorText(_err);
      const msg = matchRPCErrorMessage(_err);

      setError({
        message: err,
        ...(err.includes('out of balance') ? { type: 'out of balance' } : err.includes('timed out') ? { type: 'network error' } : null),
      });

      showMessage({
        message: t('tx.confirm.failed'),
        description: msg,
        type: 'failed',
      });
    }
  }, [clearHardwareSignState, ctx, customizeAdvanceSetting, estimateRes, navigation, rootNavigation, speedUpTx, t, txHalf, txId, type, newGasSetting]);
  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);

  return (
    <>
      <BottomSheetRoute
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose={!inSending}
        enableContentPanningGesture={!inSending}
        enableHandlePanningGesture={!inSending}
        onOpen={handleTxExpire}
      >
        <BottomSheetWrapper innerPaddingHorizontal>
          <BottomSheetHeader title={isSpeedUp ? t('tx.action.speedUp.title') : t('tx.action.cancel.title')} />
          <BottomSheetContent>
            <Text style={[styles.description, { color: colors.textPrimary }]}>{isSpeedUp ? t('tx.action.speedUp.desc') : t('tx.action.cancel.desc')}</Text>
            {(!ctx || !nativeAsset || !estimateCurrentGasPrice) && <HourglassLoading style={styles.loading} />}
            {ctx && nativeAsset && estimateCurrentGasPrice && (
              <>
                {higherGasSetting && (
                  <GasOption
                    level="higher"
                    nativeAsset={nativeAsset as any}
                    gasSetting={higherGasSetting}
                    gasLimit={customizeAdvanceSetting?.gasLimit ?? estimateRes!.gasLimit}
                    selected={tempSelectedOptionLevel === 'higher'}
                    onPress={() => setTempSelectedOptionLevel('higher')}
                  />
                )}
                {fasterGasSetting && (
                  <GasOption
                    level="faster"
                    nativeAsset={nativeAsset as any}
                    gasSetting={fasterGasSetting}
                    gasLimit={customizeAdvanceSetting?.gasLimit ?? estimateRes!.gasLimit}
                    selected={tempSelectedOptionLevel === 'faster'}
                    onPress={() => setTempSelectedOptionLevel('faster')}
                  />
                )}
                {customizeGasSetting && (
                  <GasOption
                    level="customize"
                    nativeAsset={nativeAsset as any}
                    gasSetting={customizeGasSetting}
                    gasLimit={customizeAdvanceSetting?.gasLimit ?? estimateRes!.gasLimit}
                    selected={tempSelectedOptionLevel === 'customize'}
                    onPress={() => setShowCustomizeSetting(true)}
                  />
                )}
                <Pressable style={styles.advanceWrapper} onPress={() => setShowCustomizeAdvanceSetting(true)}>
                  <Text style={[styles.advance, { color: colors.textPrimary }]}>{t('tx.gasFee.advance')}</Text>
                  <ArrowRight color={colors.iconPrimary} />
                </Pressable>
              </>
            )}
            {error && (
              <>
                {error.type === 'out of balance' ? (
                  <View style={styles.errorWarp}>
                    <WarnIcon style={styles.errorIcon} color={colors.middle} width={24} height={24} />
                    <Text style={[styles.errorText, { color: colors.middle }]}>
                      {`${isSpeedUp && ctx?.assetType === AssetType.Native ? t('tx.confirm.error.InsufficientBalance', { symbol: nativeAsset?.symbol }) : t('tx.confirm.error.InsufficientBalanceForGas', { symbol: nativeAsset?.symbol })}`}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.errorWarp}>
                    <ProhibitIcon style={styles.errorIcon} width={24} height={24} />
                    {error.type === 'network error' ? (
                      <Text style={[styles.errorText, { color: colors.down }]}>{t('tx.confirm.error.network')}</Text>
                    ) : (
                      <Text style={[styles.errorText, { color: colors.down }]}>{t('tx.confirm.error.unknown')}</Text>
                    )}
                  </View>
                )}
              </>
            )}
          </BottomSheetContent>
          <BottomSheetFooter>
            <View style={styles.btnArea}>
              <Button testID="cancel" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()} disabled={inSending}>
                {t('common.cancel')}
              </Button>
              <Button
                testID="speed-up"
                style={styles.btn}
                size="small"
                onPress={handleSend}
                disabled={!tempSelectedOptionLevel || inSending}
                Icon={isSpeedUp ? RocketIcon : undefined}
              >
                {isSpeedUp ? t('tx.action.speedUpBtn') : t('tx.action.proceedBtn')}
              </Button>
            </View>
          </BottomSheetFooter>
        </BottomSheetWrapper>
      </BottomSheetRoute>
      {customizeGasSetting && showCustomizeSetting && estimateCurrentGasPrice && (
        <CustomizeGasSetting
          customizeGasSetting={customizeGasSetting}
          onConfirm={(customGasSetting) => {
            setTempSelectedOptionLevel('customize');
            setCustomizeGasSetting(customGasSetting);
          }}
          onClose={() => setShowCustomizeSetting(false)}
          estimateCurrentGasPrice={estimateCurrentGasPrice}
        />
      )}
      {estimateRes && showCustomizeAdvanceSetting && (
        <CustomizeAdvanceSetting
          customizeAdvanceSetting={customizeAdvanceSetting}
          estimateNonce={ctx?.payload.nonce ?? 0}
          estimateGasLimit={estimateRes.gasLimit}
          onConfirm={setCustomizeAdvanceSetting}
          onClose={() => setShowCustomizeAdvanceSetting(false)}
          nonceDisabled
        />
      )}
      {hardwareSignState && (
        <HardwareSignVerify
          state={hardwareSignState}
          onClose={() => {
            clearHardwareSignState();
            abortRef.current?.abort();
          }}
          onRetry={handleSend}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  loading: {
    marginTop: 60,
    alignSelf: 'center',
    width: 60,
    height: 60,
  },
  description: {
    marginTop: 18,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '300',
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
  rocket: {
    marginLeft: 2,
    transform: [{ translateY: 1 }],
  },
  errorWarp: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  errorIcon: {
    marginRight: 4,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  advanceWrapper: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  advance: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});

const snapPoints = [650];

export default SpeedUp;

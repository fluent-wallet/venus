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
import type { FeeSelection, ReviewReplacementInput, TransactionReviewOverride } from '@core/services/transaction';
import { AssetType, SPEED_UP_ACTION } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import useInAsync from '@hooks/useInAsync';
import HardwareSignVerify from '@pages/SendTransaction/HardwareSignVerify';
import { useHardwareSigningUiState } from '@pages/SendTransaction/Step4Confirm/useHardwareSigningUiState';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { SpeedUpStackName, StackNavigation, StackScreenProps } from '@router/configs';
import { useAssetsOfAddress } from '@service/asset';
import { getAssetsSyncService } from '@service/core';
import { useExecuteReplacement, useReplacementReview, useSpeedUpTxContext } from '@service/transaction';
import { isTransactionPendingState, isTransactionSuccessfulState } from '@service/transactionStatus';
import backToHome from '@utils/backToHome';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { type AdvanceSetting, GasOption, type GasSetting, type SpeedUpLevel } from '../GasFeeSetting';
import CustomizeAdvanceSetting from '../GasFeeSetting/CustomizeAdvanceSetting';
import CustomizeGasSetting from '../GasFeeSetting/CustomizeGasSetting';
import { getGasSettingPrimaryFee, toFeeFields, toGasSetting } from '../GasFeeSetting/gasSetting';

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

const getUiErrorType = (message: string): { type: 'out of balance' | 'network error' } | null => {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('out of balance')) {
    return { type: 'out of balance' };
  }

  if (normalizedMessage.includes('timed out') || normalizedMessage.includes('network error')) {
    return { type: 'network error' };
  }

  return null;
};

function buildReviewOverride(params: {
  level: SpeedUpLevel | undefined;
  gasSetting: GasSetting | null;
  advanceSetting: AdvanceSetting | null;
  presetSelection: FeeSelection;
  nonce: number | undefined;
}): TransactionReviewOverride | undefined {
  const { level, gasSetting, advanceSetting, presetSelection, nonce } = params;
  if (!advanceSetting) {
    return undefined;
  }

  const feeSelection: FeeSelection =
    level === 'customize' && gasSetting
      ? {
          kind: 'custom',
          fee: toFeeFields(gasSetting),
        }
      : presetSelection;

  return {
    feeSelection,
    gasLimit: advanceSetting.gasLimit,
    storageLimit: advanceSetting.storageLimit,
    nonce,
  };
}

const SpeedUp: React.FC<StackScreenProps<typeof SpeedUpStackName>> = ({ navigation, route }) => {
  const { txId, type, level: defaultLevel } = route.params;
  const isSpeedUp = type === SPEED_UP_ACTION.SpeedUp;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const rootNavigation = useNavigation<StackNavigation>();
  const { data: ctx } = useSpeedUpTxContext(txId);
  const executeReplacement = useExecuteReplacement();

  const addressId = ctx?.addressId ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);
  const abortRef = useRef<AbortController | null>(null);

  const { data: assets } = useAssetsOfAddress(addressId);
  const nativeAsset = useMemo(() => assets?.find((a) => a.type === AssetType.Native) ?? null, [assets]);
  const txState = ctx?.state ?? null;
  const action = isSpeedUp ? SPEED_UP_ACTION.SpeedUp : SPEED_UP_ACTION.Cancel;

  const [error, setError] = useState<{ type?: string; message: string } | null>(null);
  const [customizeGasSetting, setCustomizeGasSetting] = useState<GasSetting | null>(null);
  const [showCustomizeSetting, setShowCustomizeSetting] = useState(false);
  const [showCustomizeAdvanceSetting, setShowCustomizeAdvanceSetting] = useState(false);
  const [customizeAdvanceSetting, setCustomizeAdvanceSetting] = useState<AdvanceSetting | null>(null);
  const [tempSelectedOptionLevel, setTempSelectedOptionLevel] = useState<SpeedUpLevel | undefined>(defaultLevel);
  const bottomSheetRef = useRef<BottomSheetMethods | null>(null);

  const baselineReviewInput = useMemo<ReviewReplacementInput | null>(
    () =>
      ctx
        ? {
            txId,
            action,
          }
        : null,
    [action, ctx, txId],
  );
  const baselineReviewQuery = useReplacementReview(baselineReviewInput);
  const baselineReview = baselineReviewQuery.data ?? null;
  const baselineFee = baselineReview?.fee ?? null;
  const baselineAdvanceSetting = useMemo(() => {
    if (!baselineFee) {
      return null;
    }

    return {
      gasLimit: baselineFee.gasLimit,
      storageLimit: baselineFee.storageLimit,
      nonce: baselineFee.nonce,
    } satisfies AdvanceSetting;
  }, [baselineFee]);
  const mediumPresetOption = useMemo(
    () => baselineReview?.presetOptions.find((option) => option.presetId === 'medium') ?? null,
    [baselineReview?.presetOptions],
  );
  const highPresetOption = useMemo(() => baselineReview?.presetOptions.find((option) => option.presetId === 'high') ?? null, [baselineReview?.presetOptions]);

  const higherGasSetting = useMemo(() => {
    return mediumPresetOption ? toGasSetting(mediumPresetOption.fee) : null;
  }, [mediumPresetOption]);

  const fasterGasSetting = useMemo(() => {
    return highPresetOption ? toGasSetting(highPresetOption.fee) : null;
  }, [highPresetOption]);

  useEffect(() => {
    if (customizeGasSetting === null && fasterGasSetting && higherGasSetting) {
      setCustomizeGasSetting(defaultLevel === 'faster' ? fasterGasSetting : higherGasSetting);
    }
  }, [customizeGasSetting, defaultLevel, fasterGasSetting, higherGasSetting]);

  useEffect(() => {
    if (baselineAdvanceSetting && customizeAdvanceSetting === null) {
      setCustomizeAdvanceSetting(baselineAdvanceSetting);
    }
  }, [baselineAdvanceSetting, customizeAdvanceSetting]);

  const effectiveAdvanceSetting = customizeAdvanceSetting ?? baselineAdvanceSetting;
  const hasAdvanceOverride = useMemo(() => {
    if (!baselineAdvanceSetting || !effectiveAdvanceSetting) {
      return false;
    }

    return (
      effectiveAdvanceSetting.gasLimit !== baselineAdvanceSetting.gasLimit ||
      effectiveAdvanceSetting.storageLimit !== baselineAdvanceSetting.storageLimit ||
      effectiveAdvanceSetting.nonce !== baselineAdvanceSetting.nonce
    );
  }, [baselineAdvanceSetting, effectiveAdvanceSetting]);
  const presetSelection = useMemo<FeeSelection>(() => {
    if (tempSelectedOptionLevel === 'faster') {
      return { kind: 'preset', presetId: 'high' };
    }

    return { kind: 'preset', presetId: 'medium' };
  }, [tempSelectedOptionLevel]);
  const selectedGasSetting = useMemo(
    () => (tempSelectedOptionLevel === 'customize' ? customizeGasSetting : tempSelectedOptionLevel === 'faster' ? fasterGasSetting : higherGasSetting),
    [customizeGasSetting, fasterGasSetting, higherGasSetting, tempSelectedOptionLevel],
  );
  const reviewOverride = useMemo(
    () =>
      buildReviewOverride({
        level: tempSelectedOptionLevel,
        gasSetting: selectedGasSetting,
        advanceSetting: effectiveAdvanceSetting,
        presetSelection,
        nonce: ctx?.payload.nonce,
      }),
    [ctx?.payload.nonce, effectiveAdvanceSetting, presetSelection, selectedGasSetting, tempSelectedOptionLevel],
  );
  const needsCustomReview = tempSelectedOptionLevel === 'faster' || tempSelectedOptionLevel === 'customize' || hasAdvanceOverride;
  const reviewInput = useMemo<ReviewReplacementInput | null>(
    () =>
      ctx
        ? {
            txId,
            action,
            override: reviewOverride,
          }
        : null,
    [action, ctx, reviewOverride, txId],
  );
  const reviewQuery = useReplacementReview(reviewInput, { enabled: !!reviewInput && !!reviewOverride && needsCustomReview });
  const review = needsCustomReview ? (reviewQuery.data ?? null) : baselineReview;
  const reviewFee = review?.fee ?? baselineFee;
  const activeReviewQuery = needsCustomReview ? reviewQuery : baselineReviewQuery;
  const isReviewPending = needsCustomReview && (reviewQuery.isFetching || reviewQuery.isPlaceholderData || !reviewQuery.data);
  const activeQueryError = isReviewPending ? null : needsCustomReview ? reviewQuery.error : baselineReviewQuery.error;

  useEffect(() => {
    if (isReviewPending) {
      setError(null);
      return;
    }

    if (activeQueryError) {
      const message = getErrorText(activeQueryError);
      setError({
        message,
        ...(getUiErrorType(message) ?? null),
      });
      return;
    }

    if (!review?.error) {
      setError(null);
      return;
    }

    setError({
      message: review.error.message,
      ...(review.error.code === 'insufficient_native_for_fee' ? { type: 'out of balance' } : (getUiErrorType(review.error.message) ?? null)),
    });
  }, [activeQueryError, isReviewPending, review?.error]);

  const handleTxExpire = useCallback(() => {
    if (txState && !isTransactionPendingState(txState)) {
      bottomSheetRef.current?.close();
      showMessage({
        type: 'warning',
        message: t('tx.action.expiredTitle'),
        description: isTransactionSuccessfulState(txState) ? t('tx.action.alreadyExecuted') : t('tx.action.alreadyFailed'),
      });
    }
  }, [t, txState]);

  useEffect(() => {
    handleTxExpire();
  }, [handleTxExpire]);

  const _handleSend = useCallback(async () => {
    if (!ctx || !selectedGasSetting || !effectiveAdvanceSetting) return;

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
      const preparedReview = await activeReviewQuery.refetch({ throwOnError: true });
      const prepared = preparedReview.data?.prepared;

      if (!prepared) {
        return;
      }

      await executeReplacement(prepared, { signal: controller?.signal });

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
      const msg = matchRPCErrorMessage(_err as { message?: string; data?: string; code?: number });

      setError({
        message: err,
        ...(getUiErrorType(err) ?? null),
      });

      showMessage({
        message: t('tx.confirm.failed'),
        description: msg,
        type: 'failed',
      });
    }
  }, [activeReviewQuery, clearHardwareSignState, ctx, effectiveAdvanceSetting, executeReplacement, navigation, rootNavigation, selectedGasSetting, t]);
  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);

  const canSubmit = !activeQueryError && !isReviewPending && review?.canSubmit === true && !!review?.prepared;
  const estimateCurrentGasPrice = useMemo(() => getGasSettingPrimaryFee(selectedGasSetting), [selectedGasSetting]);

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
            {(!ctx || !nativeAsset || !reviewFee) && <HourglassLoading style={styles.loading} />}
            {ctx && nativeAsset && reviewFee && (
              <>
                {higherGasSetting && (
                  <GasOption
                    level="higher"
                    nativeAsset={nativeAsset}
                    gasSetting={higherGasSetting}
                    gasLimit={effectiveAdvanceSetting?.gasLimit ?? reviewFee.gasLimit}
                    selected={tempSelectedOptionLevel === 'higher'}
                    onPress={() => setTempSelectedOptionLevel('higher')}
                  />
                )}
                {fasterGasSetting && (
                  <GasOption
                    level="faster"
                    nativeAsset={nativeAsset}
                    gasSetting={fasterGasSetting}
                    gasLimit={effectiveAdvanceSetting?.gasLimit ?? reviewFee.gasLimit}
                    selected={tempSelectedOptionLevel === 'faster'}
                    onPress={() => setTempSelectedOptionLevel('faster')}
                  />
                )}
                {customizeGasSetting && (
                  <GasOption
                    level="customize"
                    nativeAsset={nativeAsset}
                    gasSetting={customizeGasSetting}
                    gasLimit={effectiveAdvanceSetting?.gasLimit ?? reviewFee.gasLimit}
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
            {error &&
              (error.type === 'out of balance' ? (
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
              ))}
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
                disabled={!tempSelectedOptionLevel || inSending || !canSubmit}
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
      {reviewFee && showCustomizeAdvanceSetting && (
        <CustomizeAdvanceSetting
          customizeAdvanceSetting={customizeAdvanceSetting}
          estimateNonce={ctx?.payload.nonce ?? 0}
          estimateGasLimit={reviewFee.gasLimit}
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

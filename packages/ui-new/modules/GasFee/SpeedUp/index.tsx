import BottomSheet, { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, BottomSheetFooter, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { GasOption, type GasSetting, type SpeedUpLevel } from '../GasFeeSetting';
import {
  useTxFromId,
  usePayloadOfTx,
  useNativeAssetOfNetwork,
  NetworkType,
  useVaultOfAccount,
  VaultType,
  AssetType,
} from '@core/WalletCore/Plugins/ReactInject';
import plugins from '@core/WalletCore/Plugins';
import { showMessage } from 'react-native-flash-message';
import { useTheme } from '@react-navigation/native';
import type { SpeedUpStackName, StackScreenProps } from '@router/configs';
import RocketIcon from '@assets/icons/rocket.svg';
import { from, of, catchError, delay, switchMap } from 'rxjs';
import Decimal from 'decimal.js';
import type React from 'react';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import CustomizeGasSetting from '../GasFeeSetting/CustomizeGasSetting';
import { SignTransactionCancelError, useSignTransaction } from '@hooks/useSignTransaction';
import { useAccountOfTx, useAssetOfTx, useNetworkOfTx } from '@core/WalletCore/Plugins/ReactInject/data/useTxs';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import BSIMVerify, { useBSIMVerify } from '@pages/SendTransaction/BSIMVerify';
import { BSIMEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import type { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import methods from '@core/WalletCore/Methods';
import events from '@core/WalletCore/Events';
import { SignType } from '@core/database/models/Signature/type';
import { BSIMError } from 'modules/BSIM/src';
import WarnIcon from '@assets/icons/warn.svg';
import ProhibitIcon from '@assets/icons/prohibit.svg';
import { SpeedUpAction, TransactionActionType } from '@core/WalletCore/Events/broadcastTransactionSubject';
import useInAsync from '@hooks/useInAsync';
import { formatStatus } from '@core/utils/tx';

const higherRatio = 1.1;
const fasterRatio = 1.2;

const createGasSetting = (txPayload: ReturnType<typeof usePayloadOfTx>, ratio: number, currentGasPrice: string | null) => {
  if (!txPayload || !currentGasPrice) return null;
  if (txPayload.maxFeePerGas) {
    let suggestedMaxFeePerGas = new Decimal(txPayload.maxFeePerGas || 0).mul(ratio);
    let suggestedMaxPriorityFeePerGas = new Decimal(txPayload.maxPriorityFeePerGas || 0).mul(ratio);
    if (suggestedMaxFeePerGas.lessThanOrEqualTo(currentGasPrice)) {
      suggestedMaxPriorityFeePerGas = suggestedMaxFeePerGas = new Decimal(currentGasPrice || 0).mul(ratio);
    }
    return {
      suggestedMaxFeePerGas: suggestedMaxFeePerGas.toHex(),
      suggestedMaxPriorityFeePerGas: suggestedMaxPriorityFeePerGas.toHex(),
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

const SpeedUp: React.FC<StackScreenProps<typeof SpeedUpStackName>> = ({ route }) => {
  const { txId, type, level: defaultLevel } = route.params;
  const { colors } = useTheme();
  const { t } = useTranslation();

  const signTransaction = useSignTransaction();
  const { bsimEvent, setBSIMEvent, execBSIMCancel, setBSIMCancel } = useBSIMVerify();

  const tx = useTxFromId(txId);
  const txPayload = usePayloadOfTx(txId);
  const txAsset = useAssetOfTx(txId);
  const network = useNetworkOfTx(txId);
  const account = useAccountOfTx(txId);
  const vault = useVaultOfAccount(account?.id);
  const nativeAsset = useNativeAssetOfNetwork(network?.id);
  const txStatus = tx && formatStatus(tx);

  const [error, setError] = useState<{ type?: string; message: string } | null>(null);

  const [estimateCurrentGasPrice, setCurrentEstimateCurrentGasPrice] = useState<string | null>(null);
  useEffect(() => {
    if (!network) return;
    from(plugins.Transaction.getGasPrice(network))
      .pipe(
        catchError((error) => {
          console.log('Error:', error);
          return of(error).pipe(
            delay(1000),
            switchMap(() => from(plugins.Transaction.getGasPrice(network))),
          );
        }),
      )
      .subscribe((gasPrice) => setCurrentEstimateCurrentGasPrice(gasPrice));
  }, [network?.id]);

  const higherGasSetting = useMemo(() => createGasSetting(txPayload, higherRatio, estimateCurrentGasPrice), [txPayload, estimateCurrentGasPrice]);
  const fasterGasSetting = useMemo(() => createGasSetting(txPayload, fasterRatio, estimateCurrentGasPrice), [txPayload, estimateCurrentGasPrice]);
  const [customizeGasSetting, setCustomizeGasSetting] = useState<GasSetting | null>(null);
  const [showCustomizeSetting, setShowCustomizeSetting] = useState(false);

  useEffect(() => {
    if (customizeGasSetting === null && fasterGasSetting && higherGasSetting) {
      setCustomizeGasSetting(defaultLevel === 'faster' ? fasterGasSetting : higherGasSetting);
    }
  }, [fasterGasSetting, higherGasSetting, defaultLevel, customizeGasSetting]);

  const [tempSelectedOptionLevel, setTempSelectedOptionLevel] = useState<SpeedUpLevel | undefined>(defaultLevel);
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const isSpeedUp = type === SpeedUpAction.SpeedUp;

  useEffect(() => {
    if (txStatus && txStatus !== 'pending') {
      bottomSheetRef.current?.close();
      showMessage({
        type: 'warning',
        message: `${isSpeedUp ? 'Speed up transaction' : 'Cancel transaction'} expire`,
        description: 'Current transaction is onChain',
      });
    }
  }, [txStatus, isSpeedUp]);

  const newGasSetting =
    tempSelectedOptionLevel === 'customize' ? customizeGasSetting : tempSelectedOptionLevel === 'faster' ? fasterGasSetting : higherGasSetting;

  const _handleSend = useCallback(async () => {
    if (!network || !tx || !txPayload || !newGasSetting) return;
    const address = await tx.address;
    try {
      let txEpochHeight = txPayload.epochHeight;
      if (network.networkType === NetworkType.Conflux) {
        const currentEpochHeight = await plugins.BlockNumberTracker.getNetworkBlockNumber(network);
        if (!txEpochHeight || !checkDiffInRange(BigInt(currentEpochHeight) - BigInt(txEpochHeight))) {
          txEpochHeight = currentEpochHeight;
        }
      }
      const txData: ITxEvm = {
        to: isSpeedUp ? txPayload.to! : await address.getValue(),
        value: isSpeedUp ? txPayload.value! : '0x0',
        data: isSpeedUp ? txPayload.data! : '0x',
        from: txPayload.from!,
        nonce: txPayload.nonce!,
        gasLimit: txPayload.gas!,
        chainId: txPayload.chainId!,
        storageLimit: txPayload.storageLimit!,
        ...(newGasSetting.suggestedMaxFeePerGas
          ? {
              type: 2,
              maxFeePerGas: newGasSetting.suggestedMaxFeePerGas,
              maxPriorityFeePerGas: newGasSetting.suggestedMaxPriorityFeePerGas,
            }
          : { gasPrice: newGasSetting.suggestedGasPrice, type: 0 }),
      };
      if (vault?.type === VaultType.BSIM) {
        setBSIMEvent({ type: BSIMEventTypesName.BSIM_SIGN_START });
      }
      try {
        const { txRawPromise, cancel } = await signTransaction({ ...txData, epochHeight: txEpochHeight ?? '' });
        setBSIMCancel(cancel);
        const txRaw = await txRawPromise;
        const signature = await methods.createSignature({
          address,
          signType: SignType.TX,
        });
        const txHash = await plugins.Transaction.sendRawTransaction({ txRaw, network });
        setBSIMEvent(null);
        showMessage({
          type: 'success',
          message: t('tx.confirm.submitted.message'),
          description: t('tx.confirm.submitted.description'),
          icon: 'loading' as unknown as undefined,
        });
        if (txRaw) {
          events.broadcastTransactionSubjectPush.next({
            transactionType: TransactionActionType.SpeedUp,
            params: {
              txHash,
              txRaw,
              tx: txData,
              signature,
              originTx: tx,
              sendAt: new Date(),
              epochHeight: network.networkType === NetworkType.Conflux ? txEpochHeight : null,
              speedupAction: type,
            },
          });
        }
        bottomSheetRef.current?.close();
      } catch (error) {
        if (error instanceof BSIMError) {
          setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: error?.message });
        } else {
          // throw error to outer catch
          throw error;
        }
      }
    } catch (_err: any) {
      setBSIMEvent(null);
      const err = String(_err.data || _err?.message || _err);
      if (_err instanceof SignTransactionCancelError) {
        // ignore cancel error
        return;
      }
      setError({
        message: err,
        ...(err.includes('out of balance') ? { type: 'out of balance' } : err.includes('timed out') ? { type: 'network error' } : null),
      });
      showMessage({
        message: t('tx.confirm.failed'),
        description: err,
        type: 'failed',
      });
    }
  }, [newGasSetting, network, tx, txPayload, vault?.type, signTransaction]);
  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        isRoute
        enablePanDownToClose={!inSending}
        enableContentPanningGesture={!inSending}
        enableHandlePanningGesture={!inSending}
      >
        <BottomSheetWrapper innerPaddingHorizontal>
          <BottomSheetHeader title={isSpeedUp ? t('tx.action.speedUp.title') : t('tx.action.cancel.title')} />
          <BottomSheetContent>
            <Text style={[styles.description, { color: colors.textPrimary }]}>{isSpeedUp ? t('tx.action.speedUp.desc') : t('tx.action.cancel.desc')}</Text>
            {(!txPayload || !nativeAsset || !estimateCurrentGasPrice) && <HourglassLoading style={styles.loading} />}
            {txPayload && nativeAsset && estimateCurrentGasPrice && (
              <>
                {higherGasSetting && (
                  <GasOption
                    level="higher"
                    nativeAsset={nativeAsset}
                    gasSetting={higherGasSetting}
                    gasLimit={txPayload.gas ?? '0x0'}
                    selected={tempSelectedOptionLevel === 'higher'}
                    onPress={() => setTempSelectedOptionLevel('higher')}
                  />
                )}
                {fasterGasSetting && (
                  <GasOption
                    level="faster"
                    nativeAsset={nativeAsset}
                    gasSetting={fasterGasSetting}
                    gasLimit={txPayload.gas ?? '0x0'}
                    selected={tempSelectedOptionLevel === 'faster'}
                    onPress={() => setTempSelectedOptionLevel('faster')}
                  />
                )}
                {customizeGasSetting && (
                  <GasOption
                    level="customize"
                    nativeAsset={nativeAsset}
                    gasSetting={customizeGasSetting}
                    gasLimit={txPayload.gas ?? '0x0'}
                    selected={tempSelectedOptionLevel === 'customize'}
                    onPress={() => setShowCustomizeSetting(true)}
                  />
                )}
              </>
            )}
            {error && (
              <>
                {error.type === 'out of balance ' ? (
                  <View style={styles.errorWarp}>
                    <WarnIcon style={styles.errorIcon} color={colors.middle} width={24} height={24} />
                    <Text style={[styles.errorText, { color: colors.middle }]}>
                      {`${txAsset?.type === AssetType.Native ? t('tx.confirm.error.InsufficientBalance', { symbol: nativeAsset?.symbol }) : t('tx.confirm.error.InsufficientBalanceForGas', { symbol: nativeAsset?.symbol })}`}
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
      </BottomSheet>
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
      {bsimEvent && (
        <BSIMVerify
          bsimEvent={bsimEvent}
          onClose={() => {
            setBSIMEvent(null);
            execBSIMCancel();
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
});

const snapPoints = [600];

export default SpeedUp;

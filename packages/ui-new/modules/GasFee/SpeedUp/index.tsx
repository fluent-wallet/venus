import BottomSheet, { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, BottomSheetFooter, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { GasOption, type GasSetting, type SpeedUpLevel } from '../GasFeeSetting';
import { useTxFromId, usePayloadOfTx, TxStatus, useCurrentNetwork, useNativeAssetOfCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
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

const higherRatio = 1.1;
const fasterRatio = 1.2;
const defaultLevel: SpeedUpLevel = 'faster';

const createGasSetting = (txPayload: ReturnType<typeof usePayloadOfTx>, ratio: number) => {
  if (!txPayload) return null;
  if (txPayload.maxFeePerGas) {
    return {
      suggestedMaxFeePerGas: new Decimal(txPayload.maxFeePerGas || 0).mul(ratio).toHex(),
      suggestedMaxPriorityFeePerGas: new Decimal(txPayload.maxPriorityFeePerGas || 0).mul(ratio).toHex(),
    };
  }
  return {
    suggestedGasPrice: new Decimal(txPayload.gasPrice || 0).mul(ratio).toHex(),
  };
};

const SpeedUp: React.FC<StackScreenProps<typeof SpeedUpStackName>> = ({ route }) => {
  const { txId, type } = route.params;
  const { colors } = useTheme();
  const { t } = useTranslation();

  const currentNetwork = useCurrentNetwork();
  const nativeAsset = useNativeAssetOfCurrentNetwork(currentNetwork)!;
  const tx = useTxFromId(txId);
  const txPayload = usePayloadOfTx(txId);

  const [estimateCurrentGasPrice, setCurrentEstimateCurrentGasPrice] = useState<string | null>(null);
  useEffect(() => {
    if (!currentNetwork) return;
    from(plugins.Transaction.getGasPrice(currentNetwork))
      .pipe(
        catchError((error) => {
          console.log('Error:', error);
          return of(error).pipe(
            delay(1000),
            switchMap(() => from(plugins.Transaction.getGasPrice(currentNetwork))),
          );
        }),
      )
      .subscribe((gasPrice) => setCurrentEstimateCurrentGasPrice(gasPrice));
  }, [currentNetwork?.id]);

  const higherGasSetting = useMemo(() => createGasSetting(txPayload, higherRatio), [txPayload]);
  const fasterGasSetting = useMemo(() => createGasSetting(txPayload, fasterRatio), [txPayload]);
  const [customizeGasSetting, setCustomizeGasSetting] = useState<GasSetting | null>(null);
  const [showCustomizeSetting, setShowCustomizeSetting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (customizeGasSetting === null && txPayload) {
      setCustomizeGasSetting(defaultLevel === 'faster' ? fasterGasSetting : higherGasSetting);
    }
  }, [txPayload]);

  const [tempSelectedOptionLevel, setTempSelectedOptionLevel] = useState<SpeedUpLevel>(defaultLevel);
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  useEffect(() => {
    if (tx?.status && tx.status !== TxStatus.PENDING) {
      bottomSheetRef.current?.close();
      showMessage({
        type: 'warning',
        message: `${type === 'SpeedUp' ? 'Speed up transaction' : 'Cancel transaction'} expire`,
        description: 'Current transaction is onChain',
      });
    }
  }, [tx?.status]);

  const handlePressConfirm = useCallback(() => {
    const newGasSetting =
      tempSelectedOptionLevel === 'customize' ? customizeGasSetting : tempSelectedOptionLevel === 'faster' ? fasterGasSetting : higherGasSetting;
    // TODO:
  }, [tempSelectedOptionLevel, customizeGasSetting, higherGasSetting, fasterGasSetting]);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isRoute>
        <BottomSheetWrapper innerPaddingHorizontal>
          <BottomSheetHeader title={type === 'SpeedUp' ? 'Speed up transaction' : 'Cancel transaction'} />
          <BottomSheetContent>
            <Text style={[styles.description, { color: colors.textPrimary }]}>
              {type === 'SpeedUp'
                ? 'Add security verification to ensure the safety of your funds.'
                : 'Try to cancel this transaction. If it has already started to execute, the cancellation will fail.'}
            </Text>
            {(!txPayload || !nativeAsset || !estimateCurrentGasPrice) && <HourglassLoading style={styles.loading} />}
            {txPayload && nativeAsset && estimateCurrentGasPrice && (
              <>
                <GasOption
                  level="higher"
                  nativeAsset={nativeAsset}
                  gasSetting={higherGasSetting!}
                  gasLimit={txPayload.gas ?? '0x0'}
                  selected={tempSelectedOptionLevel === 'higher'}
                  onPress={() => setTempSelectedOptionLevel('higher')}
                />
                <GasOption
                  level="faster"
                  nativeAsset={nativeAsset}
                  gasSetting={fasterGasSetting!}
                  gasLimit={txPayload.gas ?? '0x0'}
                  selected={tempSelectedOptionLevel === 'faster'}
                  onPress={() => setTempSelectedOptionLevel('faster')}
                />
                <GasOption
                  level="customize"
                  nativeAsset={nativeAsset}
                  gasSetting={customizeGasSetting ?? (defaultLevel === 'faster' ? fasterGasSetting! : higherGasSetting!)}
                  gasLimit={txPayload.gas ?? '0x0'}
                  selected={tempSelectedOptionLevel === 'customize'}
                  onPress={() => setShowCustomizeSetting(true)}
                />
              </>
            )}
          </BottomSheetContent>
          <BottomSheetFooter>
            <View style={styles.btnArea}>
              <Button testID="cancel" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
                {t('common.cancel')}
              </Button>
              <Button testID="speed-up" style={styles.btn} size="small" onPress={handlePressConfirm} Icon={type === 'SpeedUp' ? RocketIcon : undefined}>
                {type === 'SpeedUp' ? 'Speed Up' : 'Proceed'}
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
});

const snapPoints = [580];

export default SpeedUp;

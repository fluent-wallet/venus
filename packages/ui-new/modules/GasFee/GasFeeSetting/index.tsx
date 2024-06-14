/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { isEqual, pick } from 'lodash-es';
import Decimal from 'decimal.js';
import usePollingGasEstimateAndNonce, { type Level } from '@core/WalletCore/Plugins/Transaction/usePollingGasEstimateAndNonce';
import { useCurrentNetworkNativeAsset } from '@core/WalletCore/Plugins/ReactInject';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import GasLow from '@assets/images/gas/gas-low.png';
import GasMedium from '@assets/images/gas/gas-medium.png';
import GasHigh from '@assets/images/gas/gas-high.png';
import GasCustomizeLight from '@assets/images/gas/gas-customize-light.png';
import GasCustomizeDark from '@assets/images/gas/gas-customize-dark.png';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import CustomizeSetting from './CustomizeSetting';

export type EstimateContent = {
  suggestedMaxFeePerGas?: string;
  suggestedMaxPriorityFeePerGas?: string;
  suggestedGasPrice?: string;
  gasCost: string;
};

const MinUSDT = 0.01;
const defaultLevel: Level = 'medium';

export interface SelectedGasEstimate extends EstimateContent {
  gasLimit: string;
  storageLimit?: string;
  gasPrice: string;
  nonce: number;
  level: 'customize' | Level;
}

interface Props {
  show: boolean;
  onClose: () => void;
  tx: Parameters<typeof usePollingGasEstimateAndNonce>[0];
  onConfirm: (gasEstimate: SelectedGasEstimate) => void;
  defaultCustomizeEstimate?: Partial<SelectedGasEstimate>;
  force155?: boolean;
}

const GasFeeSetting: React.FC<Props> = ({ show, tx, onClose, onConfirm, defaultCustomizeEstimate: _defaultCustomizeEstimate, force155 }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const isDappCustomize = !!_defaultCustomizeEstimate;

  const nativeAsset = useCurrentNetworkNativeAsset()!;
  const gasEstimate = usePollingGasEstimateAndNonce(tx);
  const estimate = gasEstimate ? gasEstimate.estimateOf1559 ?? gasEstimate.estimate : null;

  const [selectedGasEstimate, setSelectedGasEstimate] = useState<SelectedGasEstimate | null>(null);
  const [tempSelectedOptionLevel, setTempSelectedOptionLevel] = useState<SelectedGasEstimate['level'] | null>(null);
  const [customizeEstimate, setCustomizeEstimate] = useState<SelectedGasEstimate | null>(null);
  const [showCustomizeSetting, setShowCustomizeSetting] = useState(false);

  // const defaultLevel = useMemo(() => (_defaultCustomizeEstimate ? 'customize' : _defaultLevel), [_defaultCustomizeEstimate]);

  const defaultCustomizeEstimate = useMemo(() => {
    if (!gasEstimate || !estimate) return null;
    return {
      ...pick(gasEstimate, ['gasLimit', 'gasPrice', 'storageLimit', 'nonce']),
      ...estimate[defaultLevel],
      level: 'customize',
      ..._defaultCustomizeEstimate,
    } as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasEstimate]);

  useEffect(() => {
    if (!gasEstimate || !estimate || selectedGasEstimate?.level === 'customize') return;
    const level = selectedGasEstimate?.level ?? defaultLevel;
    const newGasEstimate =
      isDappCustomize && selectedGasEstimate === null
        ? defaultCustomizeEstimate!
        : ({
            ...pick(gasEstimate, ['gasLimit', 'gasPrice', 'storageLimit', 'nonce']),
            ...estimate[level],
            level,
          } as const);
    if (!isEqual(selectedGasEstimate, newGasEstimate)) {
      setSelectedGasEstimate(newGasEstimate);
      onConfirm?.(newGasEstimate);
      if (selectedGasEstimate === null) {
        if (!_defaultCustomizeEstimate) {
          setTempSelectedOptionLevel(defaultLevel);
        } else {
          setTempSelectedOptionLevel('customize');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasEstimate]);

  useEffect(() => {
    if (show && selectedGasEstimate) {
      setTempSelectedOptionLevel(selectedGasEstimate.level);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handleConfirm = useCallback(() => {
    if (tempSelectedOptionLevel === null || !gasEstimate || !estimate) return;
    const level = tempSelectedOptionLevel;
    const newGasEstimate = {
      ...pick(gasEstimate, ['gasLimit', 'gasPrice', 'storageLimit', 'nonce']),
      ...(level === 'customize' ? customizeEstimate ?? defaultCustomizeEstimate! : estimate?.[level]),
      level,
    } as const;
    setSelectedGasEstimate(newGasEstimate);
    onConfirm?.(newGasEstimate);
    bottomSheetRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasEstimate, customizeEstimate, tempSelectedOptionLevel]);

  if (!show) return;
  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} style={styles.container} index={0} onClose={onClose}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Network Fee</Text>

        {!estimate && <HourglassLoading style={styles.loading} />}
        {gasEstimate && estimate && (
          <>
            <GasOption
              level="low"
              nativeAsset={nativeAsset}
              estimateContent={estimate.low}
              selected={tempSelectedOptionLevel === 'low'}
              onPress={() => setTempSelectedOptionLevel('low')}
            />
            <GasOption
              level="medium"
              nativeAsset={nativeAsset}
              estimateContent={estimate.medium}
              selected={tempSelectedOptionLevel === 'medium'}
              onPress={() => setTempSelectedOptionLevel('medium')}
            />
            <GasOption
              level="high"
              nativeAsset={nativeAsset}
              estimateContent={estimate.high}
              selected={tempSelectedOptionLevel === 'high'}
              onPress={() => setTempSelectedOptionLevel('high')}
            />
            <GasOption
              level="customize"
              nativeAsset={nativeAsset}
              estimateContent={customizeEstimate ?? defaultCustomizeEstimate!}
              selected={tempSelectedOptionLevel === 'customize'}
              onPress={() => setShowCustomizeSetting(true)}
            />
          </>
        )}

        <Button
          testID="confirm"
          style={[styles.btn, !estimate && styles.btnInloading]}
          size="small"
          disabled={!tempSelectedOptionLevel}
          onPress={handleConfirm}
          loading={!estimate}
        >
          {t('common.confirm')}
        </Button>
      </BottomSheet>
      {gasEstimate && showCustomizeSetting && (
        <CustomizeSetting
          force155={force155}
          customizeEstimate={customizeEstimate ?? defaultCustomizeEstimate!}
          onConfirm={(newCustomizeEstimate) => {
            setTempSelectedOptionLevel('customize');
            setCustomizeEstimate(newCustomizeEstimate);
          }}
          onClose={() => setShowCustomizeSetting(false)}
        />
      )}
    </>
  );
};

export const OptionLevel: React.FC<{ level: SelectedGasEstimate['level'] }> = ({ level }) => {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();

  const map = useMemo(
    () => ({
      low: {
        label: 'Slow',
        color: colors.down,
        gasCircleSrc: GasLow,
      },
      medium: {
        label: 'Average',
        color: colors.middle,
        gasCircleSrc: GasMedium,
      },
      high: {
        label: 'Fast',
        color: colors.up,
        gasCircleSrc: GasHigh,
      },
      customize: {
        label: 'Customize',
        color: colors.textPrimary,
        gasCircleSrc: mode === 'light' ? GasCustomizeLight : GasCustomizeDark,
      },
    }),
    [colors, mode],
  );
  return (
    <View style={styles.gasOptionLevelWrapper}>
      <Image style={styles.gasCircle} source={map[level].gasCircleSrc} contentFit="contain" />
      <Text style={[styles.gasOptionLevel, { color: map[level].color }]}>{map[level].label}</Text>
    </View>
  );
};

const GasOption: React.FC<{
  level: SelectedGasEstimate['level'];
  selected: boolean;
  onPress: VoidFunction;
  nativeAsset: NonNullable<ReturnType<typeof useCurrentNetworkNativeAsset>>;
  estimateContent: EstimateContent;
}> = ({ level, nativeAsset, estimateContent, selected, onPress }) => {
  const { colors } = useTheme();

  const priceGwei = useMemo(
    () => new Decimal(estimateContent.suggestedMaxFeePerGas ?? estimateContent.suggestedGasPrice!).div(1e9).toFixed(4),
    [estimateContent.suggestedMaxFeePerGas, estimateContent.suggestedGasPrice],
  );
  const gasCost = useMemo(
    () => new Decimal(estimateContent.gasCost).div(Decimal.pow(10, nativeAsset.decimals || 18)).toString(),
    [estimateContent.gasCost, nativeAsset.decimals],
  );
  const costPriceInUSDT = useMemo(() => {
    const res = nativeAsset?.priceInUSDT && gasCost ? calculateTokenPrice({ price: nativeAsset.priceInUSDT, amount: gasCost }) : null;
    if (res && Number(res) < MinUSDT) return ' < $0.01';
    if (res) return ` ≈ $${res}`;
    return null;
  }, [gasCost, nativeAsset?.priceInUSDT]);

  return (
    <Pressable
      style={[styles.gasOptionWrapper, { borderColor: selected ? colors.borderPrimary : colors.borderFourth }]}
      onPress={onPress}
      pointerEvents={selected && level !== 'customize' ? 'none' : undefined}
    >
      <OptionLevel level={level} />
      <View style={styles.gasOptionCostWrapper}>
        <Text style={[styles.gasOptionCost, { color: colors.textSecondary }]}>{priceGwei} Gwei</Text>
        <Text style={[styles.gasOptionCost, { color: colors.textSecondary, marginLeft: 'auto' }]}>
          {gasCost} {nativeAsset?.symbol}
          {costPriceInUSDT}
        </Text>
        {level === 'customize' && <ArrowRight color={colors.textSecondary} style={styles.gasOptionArrowRight} />}
      </View>
    </Pressable>
  );
};

const snapPoints = [636];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    marginTop: 8,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  loading: {
    marginTop: 60,
    alignSelf: 'center',
    width: 60,
    height: 60,
  },
  gasOptionWrapper: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    marginTop: 24,
  },
  gasOptionLevelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gasCircle: {
    width: 16,
    height: 16,
    marginRight: 6,
    transform: [{ translateY: -1 }],
  },
  gasOptionLevel: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  gasOptionCostWrapper: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gasOptionCost: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  gasOptionArrowRight: {
    marginLeft: 8,
  },
  btn: {
    marginTop: 40,
  },
  btnInloading: {
    marginTop: 'auto',
    marginBottom: 32,
  },
});

export default GasFeeSetting;

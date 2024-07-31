import ArrowRight from '@assets/icons/arrow-right2.svg';
import Warning from '@assets/icons/message-warning.svg';
import GasCustomizeDark from '@assets/images/gas/gas-customize-dark.png';
import GasCustomizeLight from '@assets/images/gas/gas-customize-light.png';
import GasHigh from '@assets/images/gas/gas-high.png';
import GasLow from '@assets/images/gas/gas-low.png';
import GasMedium from '@assets/images/gas/gas-medium.png';
import { trimDecimalZeros, numberFormat } from '@core/utils/balance';
import BottomSheet, {
  BottomSheetWrapper,
  BottomSheetHeader,
  BottomSheetScrollContent,
  BottomSheetFooter,
  type BottomSheetMethods,
} from '@components/BottomSheet';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { useCurrentNetworkNativeAsset } from '@core/WalletCore/Plugins/ReactInject';
import usePollingGasEstimateAndNonce, { type Level } from '@core/WalletCore/Plugins/Transaction/usePollingGasEstimateAndNonce';
import { useTheme } from '@react-navigation/native';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import Decimal from 'decimal.js';
import { Image } from 'expo-image';
import { has, isEqual, keys, omit } from 'lodash-es';
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type React from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import CustomizeAdvanceSetting from './CustomizeAdvanceSetting';
import CustomizeGasSetting from './CustomizeGasSetting';

export interface GasSetting {
  suggestedMaxFeePerGas?: string;
  suggestedMaxPriorityFeePerGas?: string;
  suggestedGasPrice?: string;
}

export interface GasSettingWithLevel extends GasSetting {
  level: 'customize' | Level;
}

export type SpeedUpLevel = 'higher' | 'faster' | 'customize';

export interface AdvanceSetting {
  gasLimit: string;
  storageLimit?: string;
  nonce: number;
}

const MinUSDT = 0.01;
const defaultLevel: Level = 'medium';

export interface GasEstimate {
  gasSetting: GasSettingWithLevel;
  advanceSetting: AdvanceSetting;
  estimateCurrentGasPrice: string;
  estimateAdvanceSetting: AdvanceSetting;
}

interface Props {
  show: boolean;
  onClose: () => void;
  tx: Parameters<typeof usePollingGasEstimateAndNonce>[0];
  onConfirm: (gasEstimate: GasEstimate) => void;
  dappCustomizeGasSetting?: Partial<GasSetting>;
  dappCustomizeAdvanceSetting?: Partial<AdvanceSetting>;
  force155?: boolean;
}

export interface GasFeeSettingMethods {
  resetCustomizeSetting: VoidFunction;
}

const GasFeeSetting = forwardRef<GasFeeSettingMethods, Props>(
  ({ show, tx, onClose, onConfirm, dappCustomizeGasSetting, dappCustomizeAdvanceSetting, force155 }, ref) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const bottomSheetRef = useRef<BottomSheetMethods>(null!);

    const nativeAsset = useCurrentNetworkNativeAsset()!;

    const estimateRes = usePollingGasEstimateAndNonce(tx);
    const estimateGasSettings = estimateRes ? estimateRes.estimateOf1559 ?? estimateRes.estimate : null;
    const estimateCurrentGasPrice = estimateRes?.gasPrice ?? null;
    const estimateAdvanceSetting = useMemo(
      () =>
        estimateRes
          ? {
              gasLimit: estimateRes.gasLimit,
              storageLimit: estimateRes.storageLimit,
              nonce: estimateRes.nonce,
            }
          : null,
      [estimateRes],
    );
    const isDappCustomizeGasSettomg = !estimateRes
      ? false
      : !!dappCustomizeGasSetting &&
        (estimateRes.estimateOf1559 ? true : !(keys(dappCustomizeGasSetting).length === 1 && has(dappCustomizeGasSetting, 'suggestedMaxPriorityFeePerGas')));

    const defaultCustomizeGasSetting = useMemo(() => {
      if (!estimateRes || !estimateGasSettings) return null;

      return {
        ...estimateGasSettings[defaultLevel],
        level: 'customize',
        ...omit(dappCustomizeGasSetting, ['suggestedGasPrice', 'suggestedMaxFeePerGas', 'suggestedMaxPriorityFeePerGas']),
        ...(has(dappCustomizeGasSetting, 'suggestedMaxFeePerGas') || has(dappCustomizeGasSetting, 'suggestedGasPrice')
          ? {
              [estimateRes.estimateOf1559 ? 'suggestedMaxFeePerGas' : 'suggestedGasPrice']: estimateRes.estimateOf1559
                ? dappCustomizeGasSetting?.suggestedMaxFeePerGas ?? dappCustomizeGasSetting?.suggestedGasPrice
                : dappCustomizeGasSetting?.suggestedGasPrice ?? dappCustomizeGasSetting?.suggestedMaxFeePerGas,
            }
          : null),
        ...(estimateRes.estimateOf1559 && has(dappCustomizeGasSetting, 'suggestedMaxPriorityFeePerGas')
          ? {
              suggestedMaxPriorityFeePerGas: dappCustomizeGasSetting.suggestedMaxPriorityFeePerGas,
            }
          : null),
      } as GasSettingWithLevel;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estimateRes]);

    const [selectedGasSetting, setSelectedGasSetting] = useState<GasSettingWithLevel | null>(null);
    const [tempSelectedOptionLevel, setTempSelectedOptionLevel] = useState<GasSettingWithLevel['level'] | null>(null);
    const [customizeGasSetting, setCustomizeGasSetting] = useState<GasSetting | null>(null);
    const [showCustomizeSetting, setShowCustomizeSetting] = useState(false);
    const [showCustomizeAdvanceSetting, setShowCustomizeAdvanceSetting] = useState(false);
    const [customizeAdvanceSetting, setCustomizeAdvanceSetting] = useState<AdvanceSetting | null>(
      () => (dappCustomizeAdvanceSetting as AdvanceSetting) ?? null,
    );

    const currentGasLimit = useMemo(
      () => customizeAdvanceSetting?.gasLimit ?? estimateAdvanceSetting?.gasLimit,
      [customizeAdvanceSetting, estimateAdvanceSetting],
    );

    useEffect(() => {
      if (!estimateRes || !estimateGasSettings || selectedGasSetting?.level === 'customize') return;
      const level = selectedGasSetting?.level ?? defaultLevel;
      const newGasSetting =
        isDappCustomizeGasSettomg && selectedGasSetting === null
          ? defaultCustomizeGasSetting!
          : ({
              ...estimateGasSettings[level],
              level,
            } as const);
      if (!isEqual(selectedGasSetting, newGasSetting)) {
        setSelectedGasSetting(newGasSetting);
        onConfirm?.({
          gasSetting: newGasSetting,
          advanceSetting: {
            ...estimateAdvanceSetting,
            ...customizeAdvanceSetting,
          } as AdvanceSetting,
          estimateAdvanceSetting: estimateAdvanceSetting!,
          estimateCurrentGasPrice: estimateCurrentGasPrice!,
        });
        if (selectedGasSetting === null) {
          if (!isDappCustomizeGasSettomg) {
            setTempSelectedOptionLevel(defaultLevel);
          } else {
            setTempSelectedOptionLevel('customize');
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estimateRes]);

    useEffect(() => {
      if (show && selectedGasSetting) {
        setTempSelectedOptionLevel(selectedGasSetting.level);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const handleConfirm = useCallback(
      (isReset?: true) => {
        if ((!isReset && tempSelectedOptionLevel === null) || !estimateRes || !estimateGasSettings) return;
        const level = isReset ? 'medium' : tempSelectedOptionLevel!;
        const newGasSetting = {
          ...(level === 'customize' ? customizeGasSetting ?? defaultCustomizeGasSetting! : estimateGasSettings?.[level]),
          level,
        } as const;
        setSelectedGasSetting(newGasSetting);
        onConfirm?.({
          gasSetting: newGasSetting,
          advanceSetting: {
            ...estimateAdvanceSetting,
            ...(isReset ? null : customizeAdvanceSetting),
          } as AdvanceSetting,
          estimateAdvanceSetting: estimateAdvanceSetting!,
          estimateCurrentGasPrice: estimateCurrentGasPrice!,
        });
        if (isReset) {
          setCustomizeGasSetting(estimateGasSettings[defaultLevel]);
        }
        bottomSheetRef.current?.close();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [estimateRes, customizeGasSetting, tempSelectedOptionLevel, customizeAdvanceSetting],
    );

    const resetCustomizeSetting = useCallback(() => {
      setCustomizeAdvanceSetting(null);
      handleConfirm(true);
    }, [handleConfirm]);

    const showLongTime = useMemo(
      () =>
        tempSelectedOptionLevel === 'customize' && estimateCurrentGasPrice && customizeGasSetting
          ? new Decimal(customizeGasSetting.suggestedMaxFeePerGas ?? customizeGasSetting.suggestedGasPrice!).lessThan(estimateCurrentGasPrice)
          : false,
      [tempSelectedOptionLevel, estimateCurrentGasPrice, customizeGasSetting],
    );

    useImperativeHandle(
      ref,
      () => ({
        resetCustomizeSetting,
      }),
      [resetCustomizeSetting],
    );

    if (!show) return;
    return (
      <>
        <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={0} onClose={onClose}>
          <BottomSheetWrapper innerPaddingHorizontal>
            <BottomSheetHeader title={t('tx.gasFee.title')} />
            <BottomSheetScrollContent>
              {!estimateRes && <HourglassLoading style={styles.loading} />}
              {estimateRes && estimateGasSettings && (
                <>
                  <GasOption
                    level="low"
                    nativeAsset={nativeAsset}
                    gasSetting={estimateGasSettings.low}
                    gasLimit={currentGasLimit!}
                    selected={tempSelectedOptionLevel === 'low'}
                    onPress={() => setTempSelectedOptionLevel('low')}
                  />
                  <GasOption
                    level="medium"
                    nativeAsset={nativeAsset}
                    gasSetting={estimateGasSettings.medium}
                    gasLimit={currentGasLimit!}
                    selected={tempSelectedOptionLevel === 'medium'}
                    onPress={() => setTempSelectedOptionLevel('medium')}
                  />
                  <GasOption
                    level="high"
                    nativeAsset={nativeAsset}
                    gasSetting={estimateGasSettings.high}
                    gasLimit={currentGasLimit!}
                    selected={tempSelectedOptionLevel === 'high'}
                    onPress={() => setTempSelectedOptionLevel('high')}
                  />
                  <GasOption
                    level="customize"
                    showLongTime={showLongTime}
                    nativeAsset={nativeAsset}
                    gasSetting={customizeGasSetting ?? defaultCustomizeGasSetting!}
                    gasLimit={currentGasLimit!}
                    selected={tempSelectedOptionLevel === 'customize'}
                    onPress={() => setShowCustomizeSetting(true)}
                  />
                  <Pressable style={styles.advanceWrapper} onPress={() => setShowCustomizeAdvanceSetting(true)}>
                    <Text style={[styles.advance, { color: colors.textPrimary }]}>{t('tx.gasFee.advance')}</Text>
                    <ArrowRight color={colors.iconPrimary} />
                  </Pressable>
                </>
              )}
            </BottomSheetScrollContent>
            <BottomSheetFooter>
              <Button testID="confirm" size="small" disabled={!tempSelectedOptionLevel} onPress={() => handleConfirm()} loading={!estimateRes}>
                {t('common.confirm')}
              </Button>
            </BottomSheetFooter>
          </BottomSheetWrapper>
        </BottomSheet>
        {estimateRes && showCustomizeSetting && (
          <CustomizeGasSetting
            force155={force155}
            customizeGasSetting={customizeGasSetting ?? defaultCustomizeGasSetting!}
            onConfirm={(customGasSetting) => {
              setTempSelectedOptionLevel('customize');
              setCustomizeGasSetting(customGasSetting);
            }}
            onClose={() => setShowCustomizeSetting(false)}
            defaultMaxPriorityFeePerGas={dappCustomizeGasSetting?.suggestedMaxPriorityFeePerGas ?? '0'}
            estimateCurrentGasPrice={estimateCurrentGasPrice!}
          />
        )}
        {estimateRes && showCustomizeAdvanceSetting && (
          <CustomizeAdvanceSetting
            customizeAdvanceSetting={customizeAdvanceSetting}
            estimateNonce={estimateRes.nonce}
            estimateGasLimit={estimateRes.gasLimit}
            onConfirm={setCustomizeAdvanceSetting}
            onClose={() => setShowCustomizeAdvanceSetting(false)}
          />
        )}
      </>
    );
  },
);

export const OptionLevel: React.FC<{
  level: GasSettingWithLevel['level'] | SpeedUpLevel;
}> = ({ level }) => {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();

  const map = useMemo(
    () => ({
      low: {
        label: t('tx.gasFee.level.low'),
        color: '#FFB763',
        gasCircleSrc: GasLow,
      },
      medium: {
        label: t('tx.gasFee.level.medium'),
        color: '#64AEFF',
        gasCircleSrc: GasMedium,
      },
      high: {
        label: t('tx.gasFee.level.high'),
        color: '#36C4C4',
        gasCircleSrc: GasHigh,
      },
      customize: {
        label: t('tx.gasFee.level.customize'),
        color: colors.textPrimary,
        gasCircleSrc: mode === 'light' ? GasCustomizeLight : GasCustomizeDark,
      },
      higher: {
        label: t('tx.action.level.higher'),
        color: '#64AEFF',
        gasCircleSrc: GasMedium,
      },
      faster: {
        label: t('tx.action.level.faster'),
        color: '#36C4C4',
        gasCircleSrc: GasHigh,
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

export const GasOption: React.FC<{
  level: GasSettingWithLevel['level'] | SpeedUpLevel;
  selected: boolean;
  onPress: VoidFunction;
  nativeAsset: NonNullable<ReturnType<typeof useCurrentNetworkNativeAsset>>;
  gasSetting: GasSetting;
  gasLimit: string;
  showLongTime?: boolean;
}> = ({ level, nativeAsset, gasSetting, gasLimit, selected, onPress, showLongTime }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const priceGwei = useMemo(
    () => trimDecimalZeros(new Decimal(gasSetting.suggestedMaxFeePerGas ?? gasSetting.suggestedGasPrice!).div(1e9).toString()),
    [gasSetting.suggestedMaxFeePerGas, gasSetting.suggestedGasPrice],
  );
  const gasCost = useMemo(
    () =>
      new Decimal(gasSetting?.suggestedMaxFeePerGas ?? gasSetting.suggestedGasPrice!)
        .mul(gasLimit)
        .div(Decimal.pow(10, nativeAsset?.decimals || 18))
        .toString(),
    [nativeAsset?.decimals, gasLimit, gasSetting],
  );
  const costPriceInUSDT = useMemo(() => {
    const res =
      nativeAsset?.priceInUSDT && gasCost
        ? calculateTokenPrice({
            price: nativeAsset.priceInUSDT,
            amount: gasCost,
          })
        : null;
    if (res && Number(res) < MinUSDT) return ' < $0.01';
    if (res) return ` ≈ $${numberFormat(res, 2)}`;
    return null;
  }, [gasCost, nativeAsset?.priceInUSDT]);

  return (
    <Pressable
      style={[styles.gasOptionWrapper, { borderColor: selected ? colors.borderPrimary : colors.borderFourth }]}
      onPress={onPress}
      pointerEvents={selected && level !== 'customize' ? 'none' : undefined}
    >
      <View style={styles.gasOptionHeader}>
        <OptionLevel level={level} />
        <View style={styles.customize}>
          <Text style={[styles.gasOptionCost, { color: colors.textSecondary }]}>
            {gasCost} {nativeAsset?.symbol}
            {costPriceInUSDT}
          </Text>
          {level === 'customize' && <ArrowRight color={colors.textSecondary} style={styles.gasOptionArrowRight} />}
        </View>
      </View>
      <View style={styles.gasOptionFooter}>
        <Text style={[styles.gasOptionCost, { color: colors.textSecondary }]}>{priceGwei} Gwei</Text>

        {level === 'customize' && showLongTime && (
          <View style={styles.longTimeWrapper}>
            <Warning color={colors.middle} style={{ transform: [{ translateY: -1 }] }} />
            <Text style={[styles.gasOptionCost, { color: colors.textPrimary, fontWeight: '300' }]}>{t('tx.gasFee.longTime')}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const snapPoints = [700];

const styles = StyleSheet.create({
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
  gasOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gasOptionFooter: {
    marginTop: 12,
    paddingLeft: 21,
    height: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gasOptionCost: {
    fontSize: 14,
    lineHeight: 16,
  },
  gasOptionArrowRight: {
    marginLeft: 8,
    transform: [{ translateY: -1 }],
  },
  longTimeWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  advanceWrapper: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  customize: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  advance: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});

export default GasFeeSetting;

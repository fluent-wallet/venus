import ArrowRight from '@assets/icons/arrow-right2.svg';
import Warning from '@assets/icons/message-warning.svg';
import GasCustomizeDark from '@assets/images/gas/gas-customize-dark.png';
import GasCustomizeLight from '@assets/images/gas/gas-customize-light.png';
import GasHigh from '@assets/images/gas/gas-high.png';
import GasLow from '@assets/images/gas/gas-low.png';
import GasMedium from '@assets/images/gas/gas-medium.png';
import {
  BottomSheetFooter,
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetScrollContent,
  BottomSheetWrapper,
  InlineBottomSheet,
} from '@components/BottomSheet';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import type { FeeSelection, ReviewFee, TransactionQuotePresetOption } from '@core/services/transaction';
import { ASSET_TYPE } from '@core/types';
import { numberFormat, trimDecimalZeros } from '@core/utils/balance';
import { useTheme } from '@react-navigation/native';
import { useAssetsOfCurrentAddress } from '@service/asset';
import type { IAsset } from '@service/core';
import type { Level } from '@service/transaction';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import Decimal from 'decimal.js';
import { Image } from 'expo-image';
import { omit } from 'lodash-es';
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import CustomizeAdvanceSetting from './CustomizeAdvanceSetting';
import CustomizeGasSetting from './CustomizeGasSetting';
import { type GasSetting, type GasSettingWithLevel, getGasSettingPrimaryFee, resolveGasSettingWithLevel, toFeeFields, toGasSetting } from './gasSetting';

export type { GasSetting, GasSettingLike, GasSettingWithLevel } from './gasSetting';

export type SpeedUpLevel = 'higher' | 'faster' | 'customize';

export interface AdvanceSetting {
  gasLimit: string;
  storageLimit?: string;
  nonce: number;
}

const MinUSDT = 0.01;

interface Props {
  show: boolean;
  onClose: () => void;
  presetOptions: readonly TransactionQuotePresetOption[];
  fee: ReviewFee | null;
  onConfirm: (selection: FeeSelection, advanceSetting: AdvanceSetting) => void;
  force155?: boolean;
}

const GasFeeSetting: React.FC<Props> = ({ show, onClose, presetOptions, fee, onConfirm, force155 }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const { data: assets } = useAssetsOfCurrentAddress();
  const nativeAsset = useMemo(() => assets?.find((assetItem) => assetItem.type === ASSET_TYPE.Native) ?? null, [assets]);
  const presetGasSettings = useMemo(() => {
    if (!presetOptions.length) {
      return null;
    }

    return Object.fromEntries(
      presetOptions.map((option) => [
        option.presetId,
        {
          ...toGasSetting(option.fee),
          level: option.presetId,
        },
      ]),
    ) as Record<Level, GasSettingWithLevel>;
  }, [presetOptions]);
  const resolvedFeeSetting = useMemo(() => resolveGasSettingWithLevel({ fee, presetOptions }), [fee, presetOptions]);
  const baselineAdvanceSetting = useMemo(() => {
    if (!fee) {
      return null;
    }

    return {
      gasLimit: fee.gasLimit,
      storageLimit: fee.storageLimit,
      nonce: fee.nonce,
    } satisfies AdvanceSetting;
  }, [fee]);
  const baselineCustomFeeSetting = useMemo(() => {
    if (!resolvedFeeSetting) {
      return null;
    }

    return omit(resolvedFeeSetting, 'level') as GasSetting;
  }, [resolvedFeeSetting]);
  const currentPrimaryFee = useMemo(() => (fee?.fields ? getGasSettingPrimaryFee(toGasSetting(fee.fields)) : undefined), [fee?.fields]);

  const [selectedOptionLevel, setSelectedOptionLevel] = useState<GasSettingWithLevel['level'] | null>(null);
  const [customFeeSetting, setCustomFeeSetting] = useState<GasSetting | null>(null);
  const [customAdvanceSetting, setCustomAdvanceSetting] = useState<AdvanceSetting | null>(null);
  const [showCustomizeSetting, setShowCustomizeSetting] = useState(false);
  const [showCustomizeAdvanceSetting, setShowCustomizeAdvanceSetting] = useState(false);

  useEffect(() => {
    if (!fee) {
      setSelectedOptionLevel(null);
      setCustomFeeSetting(null);
      setCustomAdvanceSetting(null);
      return;
    }

    setSelectedOptionLevel(resolvedFeeSetting?.level ?? null);
    setCustomFeeSetting(baselineCustomFeeSetting);
    setCustomAdvanceSetting(baselineAdvanceSetting);
  }, [baselineAdvanceSetting, baselineCustomFeeSetting, resolvedFeeSetting?.level, fee]);

  const effectiveCustomizeGasSetting = customFeeSetting ?? baselineCustomFeeSetting;
  const currentGasLimit = customAdvanceSetting?.gasLimit ?? baselineAdvanceSetting?.gasLimit ?? '0x0';
  const isSelectorLoading = !fee || !presetGasSettings || !baselineAdvanceSetting || !effectiveCustomizeGasSetting || !nativeAsset;

  const handleConfirm = useCallback(() => {
    if (!baselineAdvanceSetting || !selectedOptionLevel) {
      return;
    }

    const nextAdvanceSetting = customAdvanceSetting ?? baselineAdvanceSetting;
    if (selectedOptionLevel === 'customize' && !effectiveCustomizeGasSetting) {
      return;
    }

    const nextFeeSelection: FeeSelection =
      selectedOptionLevel === 'customize' && effectiveCustomizeGasSetting
        ? {
            kind: 'custom',
            fee: toFeeFields(effectiveCustomizeGasSetting),
          }
        : {
            kind: 'preset',
            presetId: selectedOptionLevel as Level,
          };

    onConfirm(nextFeeSelection, nextAdvanceSetting);
    bottomSheetRef.current?.close();
  }, [baselineAdvanceSetting, customAdvanceSetting, effectiveCustomizeGasSetting, onConfirm, selectedOptionLevel]);

  const showLongTime = useMemo(
    () =>
      selectedOptionLevel === 'customize' && !!effectiveCustomizeGasSetting && !!currentPrimaryFee
        ? new Decimal(getGasSettingPrimaryFee(effectiveCustomizeGasSetting) ?? '0').lessThan(currentPrimaryFee)
        : false,
    [currentPrimaryFee, effectiveCustomizeGasSetting, selectedOptionLevel],
  );

  if (!show) return null;

  return (
    <>
      <InlineBottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={0} onClose={onClose}>
        <BottomSheetWrapper innerPaddingHorizontal>
          <BottomSheetHeader title={t('tx.gasFee.title')} />
          <BottomSheetScrollContent>
            {isSelectorLoading && <HourglassLoading style={styles.loading} />}
            {!isSelectorLoading && presetGasSettings && nativeAsset && (
              <>
                <GasOption
                  level="low"
                  nativeAsset={nativeAsset}
                  gasSetting={presetGasSettings.low}
                  gasLimit={currentGasLimit}
                  selected={selectedOptionLevel === 'low'}
                  onPress={() => setSelectedOptionLevel('low')}
                />
                <GasOption
                  level="medium"
                  nativeAsset={nativeAsset}
                  gasSetting={presetGasSettings.medium}
                  gasLimit={currentGasLimit}
                  selected={selectedOptionLevel === 'medium'}
                  onPress={() => setSelectedOptionLevel('medium')}
                />
                <GasOption
                  level="high"
                  nativeAsset={nativeAsset}
                  gasSetting={presetGasSettings.high}
                  gasLimit={currentGasLimit}
                  selected={selectedOptionLevel === 'high'}
                  onPress={() => setSelectedOptionLevel('high')}
                />
                <GasOption
                  level="customize"
                  showLongTime={showLongTime}
                  nativeAsset={nativeAsset}
                  gasSetting={effectiveCustomizeGasSetting}
                  gasLimit={currentGasLimit}
                  selected={selectedOptionLevel === 'customize'}
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
            <Button testID="confirm" size="small" disabled={!selectedOptionLevel || isSelectorLoading} onPress={() => handleConfirm()}>
              {t('common.confirm')}
            </Button>
          </BottomSheetFooter>
        </BottomSheetWrapper>
      </InlineBottomSheet>
      {!!(showCustomizeSetting && effectiveCustomizeGasSetting && currentPrimaryFee) && (
        <CustomizeGasSetting
          force155={force155}
          customizeGasSetting={effectiveCustomizeGasSetting}
          onConfirm={(nextCustomizeGasSetting) => {
            setSelectedOptionLevel('customize');
            setCustomFeeSetting(nextCustomizeGasSetting);
          }}
          onClose={() => setShowCustomizeSetting(false)}
          estimateCurrentGasPrice={currentPrimaryFee}
        />
      )}
      {!!(showCustomizeAdvanceSetting && baselineAdvanceSetting) && (
        <CustomizeAdvanceSetting
          customizeAdvanceSetting={customAdvanceSetting}
          estimateNonce={baselineAdvanceSetting.nonce}
          estimateGasLimit={baselineAdvanceSetting.gasLimit}
          onConfirm={setCustomAdvanceSetting}
          onClose={() => setShowCustomizeAdvanceSetting(false)}
        />
      )}
    </>
  );
};

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
  nativeAsset: Pick<IAsset, 'symbol' | 'decimals' | 'priceInUSDT'>;
  gasSetting: GasSetting;
  gasLimit: string;
  showLongTime?: boolean;
}> = ({ level, nativeAsset, gasSetting, gasLimit, selected, onPress, showLongTime }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const priceGwei = useMemo(() => trimDecimalZeros(new Decimal(getGasSettingPrimaryFee(gasSetting) ?? '0').div(1e9).toString()), [gasSetting]);
  const gasCost = useMemo(
    () =>
      new Decimal(getGasSettingPrimaryFee(gasSetting) ?? '0')
        .mul(gasLimit)
        .div(Decimal.pow(10, nativeAsset?.decimals ?? 18))
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

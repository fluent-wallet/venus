import SettingsIcon from '@assets/icons/settings.svg';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { trimDecimalZeros } from '@core/utils/balance';
import { useCurrentNetworkNativeAsset } from '@core/WalletCore/Plugins/ReactInject';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { useTheme } from '@react-navigation/native';
import Decimal from 'decimal.js';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type AdvanceSetting, type GasSettingWithLevel, OptionLevel } from './index';

const EstimateFee: React.FC<{
  gasSetting?: GasSettingWithLevel | null;
  advanceSetting?: AdvanceSetting;
  onPressSettingIcon: () => void;
  onGasCostChange?: (gasCost: string) => void;
}> = ({ gasSetting, advanceSetting, onPressSettingIcon, onGasCostChange }) => {
  const { colors } = useTheme();
  const currentNativeAsset = useCurrentNetworkNativeAsset();

  const gasCostAndPriceInUSDT = useMemo(() => {
    if (!gasSetting || !advanceSetting) return null;
    const cost = new Decimal(gasSetting.suggestedMaxFeePerGas ?? gasSetting.suggestedGasPrice!)
      .mul(advanceSetting.gasLimit)
      .div(Decimal.pow(10, currentNativeAsset?.decimals ?? 18));
    const priceInUSDT = currentNativeAsset?.priceInUSDT ? cost.mul(new Decimal(currentNativeAsset.priceInUSDT)) : null;

    return {
      cost: cost.toString(),
      priceInUSDT: priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null,
    };
  }, [gasSetting, advanceSetting, currentNativeAsset?.priceInUSDT, currentNativeAsset?.decimals]);

  useEffect(() => {
    if (!onGasCostChange || !gasCostAndPriceInUSDT?.cost) return;
    onGasCostChange?.(gasCostAndPriceInUSDT.cost);
  }, [onGasCostChange, gasCostAndPriceInUSDT?.cost]);

  const showedCostString = useMemo(() => {
    if (!gasCostAndPriceInUSDT?.cost) return null;
    if (gasCostAndPriceInUSDT?.cost.length <= 8) return gasCostAndPriceInUSDT.cost;
    return trimDecimalZeros(gasCostAndPriceInUSDT.cost.slice(0, 8)) + '...';
  }, [gasCostAndPriceInUSDT?.cost]);

  return (
    <View style={styles.estimateWrapper}>
      <View style={styles.headerWrapper}>
        {gasCostAndPriceInUSDT && (
          <View style={styles.costWrapper}>
            <TokenIcon style={styles.assetIcon} source={currentNativeAsset?.icon} />
            <Text style={[styles.gasCost, { color: colors.textPrimary }]}>
              {showedCostString} {currentNativeAsset?.symbol}
            </Text>
          </View>
        )}
        {!gasCostAndPriceInUSDT && <HourglassLoading style={{ width: 20, height: 20 }} />}
        <Pressable style={styles.gasSettingWrapper} onPress={onPressSettingIcon}>
          {gasSetting && <OptionLevel level={gasSetting.level} />}
          <SettingsIcon color={colors.textSecondary} />
        </Pressable>
      </View>
      {gasCostAndPriceInUSDT?.priceInUSDT && <Text style={[styles.priceInUSDT, { color: colors.textSecondary }]}>{gasCostAndPriceInUSDT.priceInUSDT}</Text>}
    </View>
  );
};

export default EstimateFee;

const styles = StyleSheet.create({
  estimateWrapper: {
    paddingLeft: 56,
    paddingRight: 16,
  },
  headerWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  costWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  gasSettingWrapper: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  gasCost: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  priceInUSDT: {
    paddingLeft: 32,
    fontSize: 14,
  },
  assetIcon: {
    width: 24,
    height: 24,
    borderRadius: 48,
    marginRight: 8,
  },
});

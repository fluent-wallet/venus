import SettingsIcon from '@assets/icons/settings.svg';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { useCurrentNetworkNativeAsset } from '@core/WalletCore/Plugins/ReactInject';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { GAS_FEE_FEATURE } from '@utils/features';
import { useTheme } from '@react-navigation/native';
import Decimal from 'decimal.js';
import type React from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type AdvanceSetting, type GasSettingWithLevel, OptionLevel } from './index';

const EstimateFee: React.FC<{ gasSetting?: GasSettingWithLevel | null; advanceSetting?: AdvanceSetting; onPressSettingIcon: () => void }> = ({
  gasSetting,
  advanceSetting,
  onPressSettingIcon,
}) => {
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

  return (
    <View>
      {GAS_FEE_FEATURE.allow && (
        <Pressable style={styles.gasSettingWrapper} onPress={onPressSettingIcon}>
          {gasSetting && <OptionLevel level={gasSetting.level} />}
          <SettingsIcon color={colors.textSecondary} />
        </Pressable>
      )}
      <View style={styles.estimateWrapper}>
        {gasCostAndPriceInUSDT && (
          <>
            <TokenIcon style={styles.assetIcon} source={currentNativeAsset?.icon} />
            <Text style={[styles.gasText, { color: colors.textSecondary }]}>
              {'  '}
              {gasCostAndPriceInUSDT.cost} {currentNativeAsset?.symbol}
            </Text>
            {gasCostAndPriceInUSDT.priceInUSDT && (
              <Text style={[styles.gasText, { color: colors.textSecondary }]}>
                {'    '}
                {gasCostAndPriceInUSDT.priceInUSDT}
              </Text>
            )}
          </>
        )}
        {!gasCostAndPriceInUSDT && <HourglassLoading style={{ width: 20, height: 20 }} />}
      </View>
    </View>
  );
};

export default EstimateFee;

const styles = StyleSheet.create({
  estimateWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 56,
    paddingRight: 16,
  },
  gasText: {
    fontSize: 12,
    fontWeight: '300',
  },
  gasSettingWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 56,
    paddingRight: 16,
  },
  assetIcon: {
    width: 24,
    height: 24,
    borderRadius: 48,
  },
});

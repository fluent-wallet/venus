import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Decimal from 'decimal.js';
import { useCurrentNetworkNativeAsset } from '@core/WalletCore/Plugins/ReactInject';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import Text from '@components/Text';
import HourglassLoading from '@components/Loading/Hourglass';
import SettingsIcon from '@assets/icons/settings.svg';
import { OptionLevel, type SelectedGasEstimate } from './index';

const EstimateFee: React.FC<{ gasEstimateAndNonce: SelectedGasEstimate | null; onPressSettingIcon: () => void }> = ({
  gasEstimateAndNonce,
  onPressSettingIcon,
}) => {
  const { colors } = useTheme();
  const currentNativeAsset = useCurrentNetworkNativeAsset();

  const gasCostAndPriceInUSDT = useMemo(() => {
    if (!gasEstimateAndNonce) return null;
    const cost = new Decimal(gasEstimateAndNonce.gasCost).div(Decimal.pow(10, currentNativeAsset?.decimals ?? 18));
    const priceInUSDT = currentNativeAsset?.priceInUSDT ? cost.mul(new Decimal(currentNativeAsset.priceInUSDT)) : null;
    return {
      cost: cost.toString(),
      priceInUSDT: priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null,
    };
  }, [gasEstimateAndNonce, currentNativeAsset?.priceInUSDT, currentNativeAsset?.decimals]);

  return (
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

      <Pressable style={styles.gasSettingWrapper} onPress={onPressSettingIcon}>
        {gasEstimateAndNonce && <OptionLevel level={gasEstimateAndNonce.level} />}
        <SettingsIcon color={colors.textSecondary} />
      </Pressable>
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
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assetIcon: {
    width: 24,
    height: 24,
    borderRadius: 48,
  },
});

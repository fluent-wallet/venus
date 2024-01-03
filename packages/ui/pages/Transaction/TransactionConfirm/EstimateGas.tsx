import { DEFAULT_CURRENCY_DECIMALS } from '@core/consts/network';
import { Text, useTheme } from '@rneui/themed';
import { formatUnits } from 'ethers';
import { View, ActivityIndicator, Pressable } from 'react-native';
import LoadingIcon from '@assets/icons/loading.svg';
import { balanceFormat } from '@core/utils/balance';
import Decimal from 'decimal.js';
import { useMemo } from 'react';

interface EstimateGasProps {
  loading: boolean;
  error: boolean;
  retry: () => void;
  gasLimit?: string;
  gasPrice?: string;
  priceInUSDT?: string;
}

const EstimateGas: React.FC<EstimateGasProps> = ({ gasLimit, gasPrice, loading, error, retry, priceInUSDT }) => {
  const { theme } = useTheme();

  const gas = useMemo(
    () => (loading || !gasLimit || !gasPrice ? null : formatUnits(BigInt(gasLimit) * BigInt(gasPrice), DEFAULT_CURRENCY_DECIMALS)),
    [gasLimit, gasPrice, loading]
  );
  const price = useMemo(() => {
    if (priceInUSDT && gasLimit && gasPrice) {
      const gas = formatUnits(BigInt(gasLimit) * BigInt(gasPrice), DEFAULT_CURRENCY_DECIMALS);
      if (new Decimal(gas).lessThan(new Decimal(10).pow(-2))) {
        return '<$0.01';
      }

      return `$${balanceFormat(new Decimal(gas.toString()).mul(new Decimal(priceInUSDT)).toString(), { decimals: 0, truncateLength: 2 })}`;
    } else {
      return '';
    }
  }, [priceInUSDT, gasLimit, gasPrice]);

  return (
    <View className="flex justify-center">
      <Pressable testID="reloadEstimateGas" onPress={error ? retry : undefined}>
        <Text style={{ color: theme.colors.textPrimary }} className="text-xl font-bold leading-6  text-right w-48">
          {error ? (
            <View className="flex flex-row items-center">
              <Text style={{ color: theme.colors.warnErrorPrimary }}>Unable to load</Text>
              <LoadingIcon width={24} height={24} />
            </View>
          ) : !gas ? (
            <ActivityIndicator size={24} color={theme.colors.surfaceBrand} />
          ) : (
            `${gas} CFX`
          )}
        </Text>
      </Pressable>
      <Text style={{ color: theme.colors.textSecondary }} className="text-right text-sm leading-6">
        {price}
      </Text>
    </View>
  );
};

export default EstimateGas;

import { DEFAULT_CURRENCY_DECIMALS } from '@core/consts/network';
import { Text, useTheme } from '@rneui/themed';
import { formatUnits } from 'ethers';
import { View, ActivityIndicator, Pressable } from 'react-native';
import LoadingIcon from '@assets/icons/loading.svg';
import { balanceFormat } from '@core/utils/balance';
import Decimal from 'decimal.js';

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

  const gas = loading || !gasLimit || !gasPrice ? null : formatUnits(BigInt(gasLimit) * BigInt(gasPrice), DEFAULT_CURRENCY_DECIMALS);

  const price = gas && priceInUSDT ? `$${new Decimal(gas.toString()).mul(new Decimal(priceInUSDT)).toString()}` : '';
  return (
    <View className="flex justify-center">
      <Pressable testID="reloadEstimateGas" onPress={error ? retry : undefined}>
        <Text style={{ color: theme.colors.textPrimary }} className="text-xl font-bold leading-6">
          {error ? (
            <View className="flex flex-row items-center">
              <Text style={{ color: theme.colors.warnErrorPrimary }}>Unable to load</Text>
              <LoadingIcon width={24} height={24} />
            </View>
          ) : !gas ? (
            <ActivityIndicator size={24} color={theme.colors.surfaceBrand} />
          ) : (
            `${balanceFormat(gas)} CFX`
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

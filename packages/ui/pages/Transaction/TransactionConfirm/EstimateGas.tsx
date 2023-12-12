import { DEFAULT_CURRENCY_DECIMALS } from '@core/consts/network';
import { Text, useTheme } from '@rneui/themed';
import { formatUnits } from 'ethers';
import { View, ActivityIndicator, Pressable } from 'react-native';
import LoadingIcon from '@assets/icons/loading.svg';

interface EstimateGasProps {
  loading: boolean;
  error: boolean;
  retry: () => void;
  gasLimit?: string;
  gasPrice?: string;
}

const EstimateGas: React.FC<EstimateGasProps> = ({ gasLimit, gasPrice, loading, error, retry }) => {
  const { theme } = useTheme();
  return (
    <View className="flex justify-center">
      <Text style={{ color: theme.colors.textPrimary }} className="text-xl font-bold leading-6">
        {error ? (
          <Pressable className="flex flex-row items-center" onPress={retry}>
            <Text style={{ color: theme.colors.warnErrorPrimary }}>Unable to load</Text>
            <LoadingIcon width={24} height={24} />
          </Pressable>
        ) : loading || !gasLimit || !gasPrice ? (
          <ActivityIndicator size={24} color={theme.colors.surfaceBrand} />
        ) : (
          `${formatUnits(BigInt(gasLimit) * BigInt(gasPrice), DEFAULT_CURRENCY_DECIMALS)} cfx`
        )}
      </Text>
      <Text style={{ color: theme.colors.textSecondary }} className="text-right text-sm leading-6">
        {/*  price todo */}
      </Text>
    </View>
  );
};

export default EstimateGas;

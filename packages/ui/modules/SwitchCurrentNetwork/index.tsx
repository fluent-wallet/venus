import { Button } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import NetWorkIcon from '@assets/icons/network.svg';
import { View } from 'react-native';

const SwitchCurrentNetwork = () => {
  const { theme } = useTheme();
  const currentNetwork = useCurrentNetwork();

  if (!currentNetwork) return null;
  return (
    <Button
      testID="switchNetwork"
      type="outline"
      titleStyle={{ color: theme.colors.contrastWhiteAndBlack, fontSize: 14, fontFamily: 'SF Pro Display' }}
      buttonStyle={{ borderRadius: 40, borderColor: theme.colors.surfaceSecondary, paddingHorizontal: 11, paddingVertical: 4 }}
      onPress={() => methods.switchToNetwork(currentNetwork.netId === 1030 ? 71 : 1030)}
    >
      <View className="w-[16px] h-[16px] mr-[4px]">
        <NetWorkIcon width={16} height={16} />
      </View>
      <Text className="whitespace-nowrap">{currentNetwork.name}</Text>
    </Button>
  );
};

export default SwitchCurrentNetwork;

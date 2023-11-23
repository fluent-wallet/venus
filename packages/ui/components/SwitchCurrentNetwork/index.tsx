import { Button } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';

const SwitchCurrentNetwork = () => {
  const { theme } = useTheme();
  const currentNetwork = useCurrentNetwork();

  if (!currentNetwork) return null;
  return (
    <Button
      type="outline"
      titleStyle={{ color: theme.colors.contrastWhiteAndBlack, fontSize: 10, fontFamily: 'SF Pro Display' }}
      buttonStyle={{ borderRadius: 40, borderColor: theme.colors.surfaceSecondary }}
      onPress={() => methods.switchToNetwork(currentNetwork.netId === 1030 ? 71 : 1030)}
    >
      <Text className='whitespace-nowrap'>{currentNetwork.name}</Text>
    </Button>
  );
};

export default SwitchCurrentNetwork;

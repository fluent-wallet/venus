import { Button } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';

const SwitchCurrentNetwork = () => {
  const { theme } = useTheme();
  return (
    <Button
      type="outline"
      titleStyle={{ color: theme.colors.contrastWhiteAndBlack, fontSize: 10, fontFamily: 'SF Pro Display' }}
      buttonStyle={{ borderRadius: 40, borderColor: theme.colors.surfaceSecondary }}
      onPress={currentNetwork.switchESpaceNetwork.bind(currentNetwork)}
    >
      <Text>{currentNetwork.name}</Text>
    </Button>
  );
};

export default SwitchCurrentNetwork;

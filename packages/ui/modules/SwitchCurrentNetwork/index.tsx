import React, { type ComponentProps } from 'react';
import { TouchableHighlight } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import NetWorkIcon from '@assets/icons/network.svg';
import { View } from 'react-native';
import { SWITCH_NETWORK_FEATURE } from '@utils/features';

const SwitchCurrentNetwork: React.FC<ComponentProps<typeof View>> = (props) => {
  const { theme } = useTheme();
  const currentNetwork = useCurrentNetwork();
  if (!currentNetwork) return null;
  return (
    <TouchableHighlight
      testID="switchNetwork"
      underlayColor={theme.colors.underlayColor}
      onPress={() => (SWITCH_NETWORK_FEATURE.allow ? methods.switchToNetwork(currentNetwork.netId === 1030 ? 71 : 1030) : undefined)}
      disabled={!SWITCH_NETWORK_FEATURE.allow}
      className="mr-[24px] rounded-[40px] overflow-hidden"
    >
      <View
        style={{
          borderColor: theme.colors.surfaceSecondary,
        }}
        className="flex flex-row justify-center items-center min-w-[132px] px-[12px] py-[4px] rounded-[40px] border-[1px]"
        {...props}
      >
        <View className="w-[16px] h-[16px] mr-[4px]">
          <NetWorkIcon width={16} height={16} />
        </View>
        <Text className="whitespace-nowrap" style={{ color: theme.colors.contrastWhiteAndBlack, fontSize: 14 }}>
          {SWITCH_NETWORK_FEATURE.allow ? currentNetwork.name : 'Conflux eSpace'}
        </Text>
      </View>
    </TouchableHighlight>
  );
};

export default SwitchCurrentNetwork;

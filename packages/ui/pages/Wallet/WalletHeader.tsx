import React, { type ComponentProps } from 'react';
import { Pressable, TouchableHighlight, View } from 'react-native';
import clsx from 'clsx';
import Clipboard from '@react-native-clipboard/clipboard';
import SwitchCurrentNetwork from '@modules/SwitchCurrentNetwork';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import { useNavigation } from '@react-navigation/native';
import { AccountSelectStackName, ReceiveAddressStackName, ScanQRCodeStackName, StackNavigation } from '@router/configs';
import { Text, useTheme } from '@rneui/themed';
import { shortenAddress } from '@core/utils/address';
import CopyAll from '@assets/icons/copy_all.svg';
import Flip from '@assets/icons/flip.svg';
import AccountWallet from '@assets/icons/account-wallet.svg';
import { showMessage } from 'react-native-flash-message';

export const UserAddress: React.FC = () => {
  const { theme } = useTheme();
  const currentAddressValue = useCurrentAddressValue();
  if (!currentAddressValue) return null;
  return (
    <TouchableHighlight
      testID="copyAddress"
      onPress={() => {
        Clipboard.setString(currentAddressValue);
        showMessage({
          type: 'success',
          message: 'Copied',
        });
      }}
      className="rounded-full overflow-hidden px-3"
      underlayColor={theme.colors.underlayColor}
    >
      <View className="flex flex-row rounded-full items-center">
        <Text className="text-[14px]" style={{ color: theme.colors.textSecondary }}>
          {shortenAddress(currentAddressValue)}
        </Text>
        <View className="ml-[3px]">
          <CopyAll color={theme.colors.textSecondary} width={16} height={16} />
        </View>
      </View>
    </TouchableHighlight>
  );
};

const SwitchCurrentAddress: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigation>();

  return (
    <View className="flex flex-row ml-[17px]">
      <Pressable testID="menu" onPress={() => navigation.navigate(AccountSelectStackName)}>
        <AccountWallet color={theme.colors.surfaceBrand} className="w-[24] h-[24]" style={{ marginRight: 18 }} />
      </Pressable>
      <Pressable testID="scanQRCode" onPress={() => navigation.navigate(ScanQRCodeStackName, { path: ReceiveAddressStackName })}>
        <Flip color={theme.colors.surfaceBrand} className="w-[24] h-[24]" />
      </Pressable>
    </View>
  );
};

const WalletHeader: React.FC<ComponentProps<typeof View>> = ({ className, ...props}) => (
  <View className={clsx("flex flex-row items-center justify-between h-[80px] w-full", className)} {...props}>
    <SwitchCurrentAddress />
    <SwitchCurrentNetwork />
  </View>
);

export default WalletHeader;

export const getWalletHeaderOptions = () =>
  ({
    headerLeft: () => <SwitchCurrentAddress />,
    headerTitle: () => null,
    headerRight: () => <SwitchCurrentNetwork />,
    headerTitleAlign: 'center',
  } as const);

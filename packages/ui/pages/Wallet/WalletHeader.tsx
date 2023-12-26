import { Pressable, TouchableHighlight, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import SwitchCurrentNetwork from '@modules/SwitchCurrentNetwork';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import { useNavigation } from '@react-navigation/native';
import { AccountSelectStackName, ReceiveAddressStackName, ScanQRCodeStackName, StackNavigation } from '@router/configs';
import { Icon, Text, useTheme } from '@rneui/themed';
import { shortenAddress } from '@core/utils/address';
import CopyAll from '@assets/icons/copy_all.svg';
import Flip from '@assets/icons/flip.svg';
import Menu from '@assets/icons/menu.svg';
import { statusBarHeight } from '@utils/deviceInfo';
import { showMessage, hideMessage } from 'react-native-flash-message';

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
          floating: true,
          statusBarHeight: statusBarHeight + 48,
          message: 'Copied',
          icon: () => <Icon name="done" color={theme.colors.textInvert} />,
          backgroundColor: theme.colors.warnSuccessPrimary,
          color: theme.colors.textInvert,
          textStyle: { fontSize: 12, fontFamily: 'SF Pro Display' },
          style: { display: 'flex', alignItems: 'center', alignSelf: 'center', width: 115 },
          duration: 1.5 * 1000, // 1.5s
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
        <Menu color={theme.colors.surfaceBrand} className="w-[24] h-[24]" style={{ marginRight: 18 }} />
      </Pressable>
      <Pressable testID="scanQRCode" onPress={() => navigation.navigate(ScanQRCodeStackName, { path: ReceiveAddressStackName })}>
        <Flip color={theme.colors.surfaceBrand} className="w-[24] h-[24]" />
      </Pressable>
    </View>
  );
};

export const getWalletHeaderOptions = (backgroundColor: string) =>
  ({
    headerLeft: () => <SwitchCurrentAddress />,
    headerTitle: () => null,
    headerRight: () => <SwitchCurrentNetwork />,
    headerTitleAlign: 'center',
  } as const);

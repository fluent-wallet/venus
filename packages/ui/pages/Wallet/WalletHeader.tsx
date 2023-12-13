import { Pressable, TouchableHighlight, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import SwitchCurrentNetwork from '@components/SwitchCurrentNetwork';
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

const HeaderTitle: React.FC<{ backgroundColor: string }> = ({ backgroundColor }: { backgroundColor: string }) => {
  const { theme } = useTheme();
  const currentAddressValue = useCurrentAddressValue();
  if (!currentAddressValue) return null;
  return (
    <TouchableHighlight
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
          style: { display: 'flex', alignItems: 'center', alignSelf: 'center', width: 115, },
          duration: 1.5 * 1000, // 1.5s
        });
      }}
      className="rounded-full overflow-hidden"
    >
      <View className="bg-white flex flex-row px-3 py-2 rounded-full items-center" style={{ backgroundColor }}>
        <Text className="text-[10px]">{shortenAddress(currentAddressValue)}</Text>
        <View className="ml-1 p-[3px] rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
          <CopyAll color={theme.colors.surfaceSecondary} />
        </View>
      </View>
    </TouchableHighlight>
  );
};

const SwitchCurrentAddress: React.FC = () => {
  const navigation = useNavigation<StackNavigation>();

  return (
    <View className="flex flex-row ml-[17px]">
      <Pressable onPress={() => navigation.navigate(AccountSelectStackName)}>
        <Menu className="w-[24] h-[24]" style={{ marginRight: 18 }} />
      </Pressable>
      <Pressable onPress={() => navigation.navigate(ScanQRCodeStackName, { path: ReceiveAddressStackName })}>
        <Flip className="w-[24] h-[24]" />
      </Pressable>
    </View>
  );
};

export const getWalletHeaderOptions = (backgroundColor: string) =>
  ({
    headerLeft: () => <SwitchCurrentAddress />,
    headerTitle: () => <HeaderTitle backgroundColor={backgroundColor} />,
    headerRight: () => <SwitchCurrentNetwork />,
    headerTitleAlign: 'center',
  } as const);

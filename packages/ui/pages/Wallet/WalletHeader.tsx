import { Pressable, TouchableHighlight, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import SwitchCurrentNetwork from '@components/SwitchCurrentNetwork';
import { useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import { useNavigation } from '@react-navigation/native';
import { AccountSelectStackName, ReceiveAddressStackName, ScanQRCodeStackName, StackNavigation } from '@router/configs';
import { Text } from '@rneui/themed';
import { shortenAddress } from '@core/utils/address';
import CopyAll from '@assets/icons/copy_all.svg';
import Flip from '@assets/icons/flip.svg';
import Menu from '@assets/icons/menu.svg';

const HeaderTitle: React.FC<{ backgroundColor: string }> = ({ backgroundColor }: { backgroundColor: string }) => {
  const currentAddressValue = useCurrentAddressValue();
  if (!currentAddressValue) return null;
  return (
    <TouchableHighlight onPress={() => Clipboard.setString(currentAddressValue)} className="rounded-full overflow-hidden">
      <View className="bg-white flex flex-row px-[12px] py-[8px] rounded-full" style={{ backgroundColor }}>
        <Text className="text-[10px]">{shortenAddress(currentAddressValue)}</Text>
        <View className="pl-[4px]">
          <CopyAll />
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

import { BaseButton } from '@components/Button';
import { useCurrentAccount, useGroupOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import VaultType from '@core/database/models/Vault/VaultType';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, useTheme } from '@rneui/themed';
import { BackUpStackName, RootStackList } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView, View } from 'react-native';

const BackUpNotice: React.FC<NativeStackScreenProps<RootStackList, 'BackUpNotice'>> = ({ navigation }) => {
  const { theme } = useTheme();
  const currentAccount = useCurrentAccount();
  const accountGroup = useGroupOfAccount(currentAccount?.id || '');
  return (
    <SafeAreaView
      className="flex-1 flex flex-col px-[24px] pb-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <View className="p-4">
        <Text>Notice</Text>
        <Text>
          If you lose your <Text>Seed phrase</Text> or <Text>private key</Text>, you won't be able to recover you wallet.
        </Text>
        <Text>
          Obtaining <Text>seed phrase</Text> or <Text>private key</Text> means owning all assets.
        </Text>
        <Text>
          Please <Text>protect</Text> them carefully
        </Text>
      </View>
      <BaseButton
        disabled={!accountGroup.id}
        testID="next"
        containerStyle={{ marginTop: 'auto' }}
        onPress={() =>
          navigation.navigate(BackUpStackName, {
            type: VaultType.HierarchicalDeterministic,
            accountGroupId: accountGroup.id,
          })
        }
      >
        Next
      </BaseButton>
    </SafeAreaView>
  );
};

export default BackUpNotice;

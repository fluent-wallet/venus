import { Button, useTheme } from '@rneui/themed';
import { View, SafeAreaView } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';
import { createBSIMVault, createHDVault } from '@core/DB/models/Vault/service';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackList, StackNavigationType } from 'packages/@types/natigation';
import { WalletStackName } from '@pages/Wallet';
export const CreateAccountStackName = 'CreateAccount';

const CreateAccount = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigationType>();
  const route = useRoute<RouteProp<RootStackList, 'CreateAccount'>>();
  const handleCreateHDVault = async () => {
    await createHDVault();
    navigation.navigate('Home', { screen: WalletStackName });
  };

  const handleCreateBSIMVault = async () => {
    await createBSIMVault()
    // navigation.navigate('Home', { screen: WalletStackName });
  }
  return (
    <View className="flex flex-1 relative" style={{ backgroundColor: theme.colors.normalBackground }}>
      <View className="flex-1 px-[25px]">
        <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
          <View>
            <View className="mb-4">
              <Button onPress={handleCreateHDVault}>New Seed Phrase (dev only)</Button>
            </View>
            <View className="mb-4">
              <Button className="mt-3" onPress={handleCreateBSIMVault}>Create new BSIM key</Button>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

export default CreateAccount;

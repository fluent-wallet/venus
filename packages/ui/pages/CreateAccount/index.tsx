import { Button, useTheme } from '@rneui/themed';
import { View, SafeAreaView } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';
import { createHDVault } from '@core/DB/models/Vault/service';
import { useNavigation } from '@react-navigation/native';
import { StackNavigation } from 'packages/@types/natigation';
import { WalletStackName } from '@pages/Wallet';

export const CreateAccountStackName = 'CreateAccount';

const CreateAccount: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigation>();
  const handleCreateHDVault = async () => {
    await createHDVault();
    navigation.navigate('Home', { screen: WalletStackName });
  };
  return (
    <View className="flex flex-1 relative" style={{ backgroundColor: theme.colors.normalBackground }}>
      <View className="flex-1 px-[25px]">
        <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
          <Button onPress={handleCreateHDVault}>New Seed Phrase (dev only)</Button>
        </SafeAreaView>
      </View>
    </View>
  );
};

export default CreateAccount;

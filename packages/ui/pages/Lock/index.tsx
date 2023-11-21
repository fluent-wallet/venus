import { useEffect } from 'react';
import { SafeAreaView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, Text } from '@rneui/themed';
import plugins from '@core/WalletCore/Plugins';
import { type StackNavigation, WalletStackName , HomeStackName} from '@router/configs';
import { BaseButton } from '@components/Button';


function Lock() {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigation>();
  const unLockWallet = async () => {
    try {
      await plugins.Authentication.getPassword();
      navigation.navigate(HomeStackName, { screen: WalletStackName });
    } catch (error) {
      // user cancel unlock
    }
  };

  useEffect(() => {
    unLockWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start px-[24px]" style={{ backgroundColor: theme.colors.normalBackground }}>
      <View className="flex flex-1 items-center justify-center">
        <Text className="text-4xl mb-4">Wallet is locked</Text>
        <BaseButton onPress={unLockWallet}>UNLOCK WALLET</BaseButton>
      </View>
    </SafeAreaView>
  );
}

export default Lock;

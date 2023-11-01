import { BaseButton } from '@components/Button';
import { authentication } from '@core/DB/helper';
import { useNavigation } from '@react-navigation/native';
import { useTheme, Text } from '@rneui/themed';
import { HomeStackName, StackNavigation, WalletStackName } from '@router/configs';
import { useEffect } from 'react';
import { SafeAreaView, View } from 'react-native';

export const LockStackName = 'Lock';

function Lock() {
  const { theme } = useTheme();
  const navigation = useNavigation<StackNavigation>();


  useEffect(() => {
    const unLockWallet = async () => {
      try {
        await authentication.getPassword();
        navigation.navigate(HomeStackName, { screen: WalletStackName });
      } catch (error) {
        // user cancel unlock
      }
    };
    
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

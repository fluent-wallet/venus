import { useState } from 'react';
import { SafeAreaView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@rneui/themed';
import plugins from '@core/WalletCore/Plugins';
import { HomeStackName, StackNavigation, WalletStackName } from '@router/configs';
import { BaseButton } from '@components/Button';
import Password from '@components/PasswordInput';

export const LoginStackName = 'Login';

function Login() {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<StackNavigation>();

  const handleLogin = async () => {
    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    setError('');
    setLoading(true);

    const isValidate = await plugins.Authentication.validatePassword({ inputPassword: password, authType: plugins.Authentication.AuthenticationType.Password });

    if (isValidate) {
      return navigation.navigate(HomeStackName, { screen: WalletStackName });
    } else {
      return setError('Invalid password');
    }
  };
  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start px-[24px]" style={{ backgroundColor: theme.colors.normalBackground }}>
      <View className="flex flex-1 items-center justify-center">
        <View className="w-full">
          <Password value={password} onChangeText={setPassword} helperText="" title="Password" errorMessage={error} />

          <View className="mt-6">
            <BaseButton loading={loading} disabled={!password} onPress={handleLogin}>
              UNLOCK
            </BaseButton>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default Login;

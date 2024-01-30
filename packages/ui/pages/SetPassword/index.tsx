import { useState } from 'react';
import { View, SafeAreaView, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useRoute, CommonActions, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { Text, useTheme, CheckBox } from '@rneui/themed';
import plugins from '@core/WalletCore/Plugins';
import { statusBarHeight } from '@utils/deviceInfo';
import Password from '@components/PasswordInput';
import { BaseButton } from '@components/Button';
import useInAsync from '@hooks/useInAsync';
import { isDev } from '@utils/getEnv';
import { type RootStackList, WalletStackName, HomeStackName, SetPasswordStackName } from '@router/configs';
import createVaultWithRouterParams from './createVaultWithRouterParams';
import CreatePasswordAlert from './components/Alert';

const SetPassword: React.FC<{ navigation: NavigationProp<RootStackList> }> = (props) => {
  const { navigation } = props;
  const route = useRoute<RouteProp<RootStackList, typeof SetPasswordStackName>>();
  const { theme } = useTheme();
  const [checked, setChecked] = useState(isDev ? true : false);
  const [password, setPassword] = useState({ pwd: isDev ? '12345678' : '', error: '' });
  const [confirmPwd, setConfirmPwd] = useState({ pwd: isDev ? '12345678' : '', error: '' });
  const { inAsync: loading, execAsync: createVault } = useInAsync(createVaultWithRouterParams);
  const [alert, setAlert] = useState({
    show: false,
    type: 'success',
    message: 'You’ve successfully protected wallet. Remember to keep your Password, it’s your responsibility!',
  });

  const handleSetPassword = (value: string) => {
    setPassword({ pwd: value, error: '' });
    setConfirmPwd({ pwd: confirmPwd.pwd, error: '' });
  };

  const handleConfirmPassword = (value: string) => {
    setConfirmPwd({ pwd: value, error: '' });
    setPassword({ pwd: password.pwd, error: '' });
  };

  const handleCreatePassword = async () => {
    if (password.pwd.length < 8) {
      setPassword({ pwd: password.pwd, error: 'Must be at least 8 characters' });
      return;
    }

    if (password.pwd !== confirmPwd.pwd) {
      setPassword({ pwd: password.pwd, error: 'Passwords do not match' });
      setConfirmPwd({ pwd: confirmPwd.pwd, error: 'Passwords do not match' });
      return;
    }

    try {
      navigation.setOptions({ gestureEnabled: false });
      await plugins.Authentication.setPassword({ password: confirmPwd.pwd });
      if (await createVault(route.params, confirmPwd.pwd)) {
        setAlert({ show: true, type: 'success', message: 'You’ve successfully protected wallet. Remember to keep your Password, it’s your responsibility!' });
      }
    } catch (e) {
      console.log('handleCreatePassword error: ', e);
      setAlert({ show: false, type: 'error', message: `${e}` });
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
  };

  return (
    <SafeAreaView
      className="flex flex-1 flex-col justify-start px-[24px] pb-[56px]"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView className="flex-1">
          <View>
            <Text className="text-center text-[36px] font-bold leading-tight" style={{ color: theme.colors.textBrand }}>
              Set Password
            </Text>
            <Text className="text-center text-[16px]">Add wallet password to keep your funds safe.</Text>
          </View>

          <View>
            <Password testId="passwordInput" errorMessage={password.error} value={password.pwd} onChangeText={handleSetPassword} title="New Password" />

            <Password
              testId="confirmPasswordInput"
              // errorMessage={confirmPwd !== password.pwd && confirmPwd !== '' ? 'Passwords do not match' : ''}
              errorMessage={confirmPwd.error}
              value={confirmPwd.pwd}
              onChangeText={handleConfirmPassword}
              title="Confirm New Password"
            />
          </View>
        </ScrollView>
        <View className="mt-auto flex flex-row items-center mb-[15px]">
          <CheckBox
            testID="checkbox"
            containerStyle={{ backgroundColor: 'transparent', padding: 0 }}
            checked={checked}
            onPress={() => setChecked(!checked)}
            iconType="material-community"
            checkedIcon="checkbox-marked"
            uncheckedIcon="checkbox-blank-outline"
            checkedColor={theme.colors.textBrand}
            uncheckedColor={theme.colors.textBrand}
          />
          <Text className="text-base flex-1">SwiftShield does not store your password. Please remember your password.</Text>
        </View>
        <BaseButton
          testID="createPasswordButton"
          loading={loading}
          onPress={handleCreatePassword}
          disabled={!(checked && password.pwd !== '' && confirmPwd.pwd !== '' && password.error === '' && confirmPwd.error === '')}
        >
          Create Password
        </BaseButton>

        <CreatePasswordAlert
          {...alert}
          onOk={() => {
            setAlert({ show: false, type: '', message: '' });
            navigation.navigate(HomeStackName, { screen: WalletStackName });
            navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SetPassword;

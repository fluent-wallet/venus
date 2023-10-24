import { View, SafeAreaView } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';
import { Button, Text, useTheme, CheckBox } from '@rneui/themed';
import Password from './components/Password';
import { useState } from 'react';
import CreatePasswordAlert from './components/Alert';
import { NavigationProp } from '@react-navigation/native';
import { AuthenticationType, authentication } from '@core/DB/helper';

export const SetPasswordStackName = 'SetPassword';

const SetPassword: React.FC<{ navigation: NavigationProp<any> }> = (props) => {
  const { navigation } = props;
  const { theme } = useTheme();
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState({ pwd: '', error: '' });
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({
    show: false,
    type: 'success',
    message: 'You’ve successfully protected wallet. Remember to keep your Password, it’s your responsibility!',
  });

  const handleSetPassword = (value: string) => {
    setPassword({ pwd: value, error: value.length < 8 && value !== '' ? 'Password must be at least 8 characters' : '' });
  };

  const handleConfirmPassword = (value: string) => {
    setConfirmPwd(value);
  };

  const handleCreatePassword = async () => {
    setLoading(true);

    try {
      await authentication.setPassword({ password: confirmPwd, authType: AuthenticationType.Password });
      setAlert({ show: true, type: 'success', message: 'You’ve successfully protected wallet. Remember to keep your Password, it’s your responsibility!' });
    } catch (e) {
      setAlert({ show: false, type: 'error', message: `${e}` });
    }
  };

  return (
    <View className="flex flex-1 relative" style={{ backgroundColor: theme.colors.normalBackground }}>
      <View className="flex-1 px-[25px]">
        <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
          <View>
            <Text className="text-center text-[36px] font-bold leading-tight" style={{ color: theme.colors.textBrand }}>
              Set Password
            </Text>
            <Text className="text-center text-[16px] font-normal">Add security verification to ensure the safety of your funds.</Text>
          </View>

          <View>
            <Password
              helperText="Must be at least 8 characters"
              errorMessage={password.error}
              value={password.pwd}
              onChangeText={handleSetPassword}
              title="New Password"
            />

            <Password
              helperText="Password must be match"
              errorMessage={confirmPwd !== password.pwd && confirmPwd !== '' ? 'Passwords do not match' : ''}
              value={confirmPwd}
              onChangeText={handleConfirmPassword}
              title="Confirm New Password"
            />
          </View>

          <View className=" absolute left-0 right-0  bottom-[55px]">
            <View className="flex flex-row items-center mb-[15px]">
              <CheckBox
                containerStyle={{ backgroundColor: 'transparent', padding: 0 }}
                checked={checked}
                onPress={() => setChecked(!checked)}
                iconType="material-community"
                checkedIcon="checkbox-marked"
                uncheckedIcon="checkbox-blank-outline"
                checkedColor={theme.colors.textBrand}
                uncheckedColor={theme.colors.textBrand}
              />
              <View className="flex-1">
                <Text className="text-base">ePay Wallet does not store your password. Please remember your password.</Text>
              </View>
            </View>
            <Button
              loading={loading}
              onPress={handleCreatePassword}
              disabled={!(checked && password.pwd !== '' && password.pwd === confirmPwd && password.error === '')}
            >
              Create Password
            </Button>
          </View>
        </SafeAreaView>
        <CreatePasswordAlert
          {...alert}
          onOk={() => {
            setAlert({ show: false, type: '', message: '' });
            navigation.navigate('CreateAccount');
          }}
        />
      </View>
    </View>
  );
};

export default SetPassword;

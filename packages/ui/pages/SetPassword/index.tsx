import { View, SafeAreaView } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';
import { Button, Text, useTheme, CheckBox } from '@rneui/themed';
import Password from './components/Password';
import { useState } from 'react';
import CreatePasswordAlert from './components/Alert';

function SetPassword() {
  const { theme } = useTheme();
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [alert, setAlert] = useState({
    show: false,
    type: 'success',
    message: 'You’ve successfully protected wallet. Remember to keep your Password, it’s your responsibility!',
  });

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
              errorMessage="Must be at least 6 characters!"
              helperText="Must be at least 8 characters"
              value={password}
              onChangeText={setPassword}
              title="New Password"
            />

            <Password
              successMessage="Password match!"
              helperText="Password must be match"
              value={confirmPwd}
              onChangeText={setConfirmPwd}
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
            <Button>Create Password</Button>
          </View>
        </SafeAreaView>
        <CreatePasswordAlert {...alert} />
      </View>
    </View>
  );
}

export default SetPassword;

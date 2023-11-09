import { Button } from '@rneui/base';
import { Text, useTheme, Divider } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView, View, KeyboardAvoidingView } from 'react-native';
import { TextInput } from 'react-native';
import { BaseButton } from '@components/Button';
import { type StackNavigation, TokenListStackName } from '@router/configs';
import Flip from '@assets/icons/flip.svg';
import { useState } from 'react';
import { isHexAddress } from '@core/utils/account';
import WarningIcon from '@assets/icons/warning_2.svg';
import CheckCircleIcon from '@assets/icons/check_circle.svg';

export const ReceiveAddressStackName = 'ReceiveAddress';

export const SendPageHeaderOptions = ({ title = 'Send To' }: { title?: string }) =>
  ({
    headerTitle: title,
    headerTitleAlign: 'center',
  } as const);

const SendReceiver: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [address, setAddress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (v: string) => {
    if (!isHexAddress(v)) {
      setErrorMsg('Please enter valid hex address or ens');
    } else {
      setErrorMsg('');
    }
    setAddress(v);
  };
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="mt-[13px]">
          <Text className="leading-6 ml-4 my-2">Receiver</Text>
          <View style={{ backgroundColor: theme.colors.surfaceCard }} className="flex flex-row items-center rounded-md px-4 py-2">
            <TextInput
              value={address}
              onChangeText={handleChange}
              className="flex-1 leading-6"
              placeholder="Enter an address or domain name"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <Flip width={20} height={20} />
          </View>
          <Divider className="my-4" />
          <View className="flex flex-row items-center p-3">
            {errorMsg && (
              <>
                <WarningIcon width={16} height={16} style={{ marginRight: 8 }} />
                <Text className="text-sm" style={{ color: theme.colors.warnErrorPrimary }}>
                  {errorMsg}
                </Text>
              </>
            )}
            {!!address && !errorMsg && (
              <>
                <CheckCircleIcon width={16} height={16} style={{ marginRight: 8 }} />
                <Text className="text-sm" style={{ color: theme.colors.success }}>
                  Valid Address
                </Text>
              </>
            )}
          </View>
        </View>
        <View className="mt-auto mb-6">
          <BaseButton disabled={!address || !!errorMsg} onPress={() => navigation.navigate(TokenListStackName, { address })}>
            Next
          </BaseButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SendReceiver;

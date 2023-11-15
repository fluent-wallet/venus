import { Button } from '@rneui/base';
import { Text, useTheme, Divider } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView, View, KeyboardAvoidingView } from 'react-native';
import { TextInput } from 'react-native';
import { BaseButton } from '@components/Button';
import { type StackNavigation, TokensStackName } from '@router/configs';
import Flip from '@assets/icons/flip.svg';
import { useEffect, useState } from 'react';
import { isHexAddress } from '@core/utils/account';
import WarningIcon from '@assets/icons/warning_2.svg';
import CheckCircleIcon from '@assets/icons/check_circle.svg';
import { isAddress } from 'ethers';
import { useAtom } from 'jotai';
import { setTransactionTo, transactionAtom } from '@hooks/useTransaction';

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
  const [, setFromAddress] = useAtom(setTransactionTo);

  const handleChange = (v: string) => {
    setAddress(v);
    setErrorMsg('');
  };

  const handleNext = () => {
    if (!isAddress(address)) {
      return setErrorMsg('Please enter valid hex address');
    } else {
      setErrorMsg('');
    }
    setFromAddress(address);
    navigation.navigate(TokensStackName);
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
              placeholder="Enter an address"
              maxLength={42}
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
          </View>
        </View>
        <View className="mt-auto mb-6">
          <BaseButton disabled={!address || !!errorMsg} onPress={handleNext}>
            Next
          </BaseButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SendReceiver;

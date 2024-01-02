import { useState } from 'react';
import { SafeAreaView, View, KeyboardAvoidingView, TextInput, Pressable } from 'react-native';
import { isAddress } from 'ethers';
import { useAtom } from 'jotai';
import { Text, useTheme, Divider } from '@rneui/themed';
import { type StackNavigation, TokensStackName, RootStackList, ReceiveAddressStackName, ScanQRCodeStackName } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';

import WarningIcon from '@assets/icons/warning_2.svg';
import Flip from '@assets/icons/flip.svg';
import { RouteProp } from '@react-navigation/native';
import { useReadOnlyTransaction, setTransactionTo } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';

export const SendPageHeaderOptions = ({ title = 'Send To' }: { title?: string }) =>
  ({
    headerTitle: title,
    headerTitleAlign: 'center',
  } as const);

const SendReceiver: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof ReceiveAddressStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const tx = useReadOnlyTransaction();
  const [address, setAddress] = useState(tx?.to || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [, setToAddress] = useAtom(setTransactionTo);

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
    setToAddress(address);
    navigation.navigate(TokensStackName);
  };
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="mt-[13px]">
          <Text className="leading-6 ml-4 my-2">Receiver</Text>
          <View style={{ backgroundColor: theme.colors.surfaceCard }} className="flex flex-row items-center rounded-md px-4 py-2">
            <TextInput
              testID="receiverInput"
              value={address}
              onChangeText={handleChange}
              className="flex-1 leading-6"
              placeholder="Enter an address"
              maxLength={42}
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={2}
              selectionColor={theme.colors.surfaceBrand}
            />
            <Pressable testID="scanQRCode" onPress={() => navigation.navigate(ScanQRCodeStackName, { path: ReceiveAddressStackName })}>
              <Flip color={theme.colors.surfaceBrand} width={20} height={20} />
            </Pressable>
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
        <View className="mt-auto mb-8">
          <BaseButton testID="next" disabled={!address || !!errorMsg} onPress={handleNext}>
            Next
          </BaseButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SendReceiver;

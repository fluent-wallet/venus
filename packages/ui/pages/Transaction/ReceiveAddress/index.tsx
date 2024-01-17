import { useState } from 'react';
import { SafeAreaView, View, KeyboardAvoidingView, TextInput, Pressable, ScrollView } from 'react-native';
import { isAddress } from 'ethers';
import { useAtom } from 'jotai';
import { Text, useTheme, Divider } from '@rneui/themed';
import { type StackNavigation, TokensStackName, RootStackList, ReceiveAddressStackName, ScanQRCodeStackName } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';
import { CheckBox } from '@rneui/themed';
import WarningIcon from '@assets/icons/warning_2.svg';
import WarningIcon1 from '@assets/icons/warning_1.svg';
import Flip from '@assets/icons/flip.svg';
import { RouteProp } from '@react-navigation/native';
import { useReadOnlyTransaction, setTransactionTo } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { getCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject/data/useCurrentNetwork';

export const SendPageHeaderOptions = ({ title = 'Send To' }: { title?: string }) =>
  ({
    headerTitle: title,
    headerTitleAlign: 'center',
  }) as const;

const SendReceiver: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof ReceiveAddressStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const tx = useReadOnlyTransaction();
  const [address, setAddress] = useState(tx?.to || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [, setToAddress] = useAtom(setTransactionTo);
  const [loading, setLoading] = useState(false);
  const [isContractAddress, setIsContractAddress] = useState(false);
  const [isKnowRisk, setIsKnowRisk] = useState(false);
  const currentNetwork = getCurrentNetwork();

  const handleChange = (v: string) => {
    setAddress(v);
    setErrorMsg('');
    setIsContractAddress(false);
    setIsKnowRisk(false);
  };

  const handleNext = async () => {
    setLoading(true);
    if (isAddress(address)) {
      setErrorMsg('');
      // check is contract address
      if (currentNetwork && !isContractAddress && !isKnowRisk) {
        try {
          const code = await fetchChain({ url: currentNetwork.endpoint, method: 'eth_getCode', params: [address] });
          setLoading(false);
          if (code) return setIsContractAddress(true);
        } catch (error) {
          setIsContractAddress(false);
        }
      }
    } else {
      setLoading(false);
      return setErrorMsg('Please enter valid hex address');
    }

    setLoading(false);
    setToAddress(address);
    navigation.navigate(TokensStackName);
  };

  const nextButtonDisabled = () => {
    if (!address) {
      return true;
    }

    if (errorMsg) {
      return true;
    }
    if (isContractAddress && !isKnowRisk) {
      return true;
    }
    return false;
  };

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView className="flex-1">
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
            {errorMsg && (
              <View className="flex flex-row items-center p-3">
                <WarningIcon width={16} height={16} style={{ marginRight: 8 }} />
                <Text className="text-sm" style={{ color: theme.colors.warnErrorPrimary }}>
                  {errorMsg}
                </Text>
              </View>
            )}

            {isContractAddress && (
              <View className="p-3">
                <View className="flex flex-row  p-3">
                  <WarningIcon1 width={16} height={16} style={{ marginRight: 8 }} color={theme.colors.warnErrorPrimary} />
                  <Text className="text-sm" style={{ color: theme.colors.warnErrorPrimary }}>
                    This address is a contract address, and transferring to this address may result in asset loss.
                  </Text>
                </View>
                <View className="flex flex-row items-center">
                  <CheckBox
                    testID="knowRisk"
                    containerStyle={{ padding: 0, marginLeft: 0, backgroundColor: theme.colors.surfacePrimaryWithOpacity7 }}
                    checked={isKnowRisk}
                    onPress={() => setIsKnowRisk((bl) => !bl)}
                    iconType="material-community"
                    checkedIcon="checkbox-marked"
                    uncheckedIcon="checkbox-blank-outline"
                    checkedColor={theme.colors.textBrand}
                    uncheckedColor={theme.colors.textBrand}
                  />
                  <Text className="text-sm" style={{ color: theme.colors.warnErrorPrimary }}>
                    Know this risks
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View className="mt-auto mb-8">
            <BaseButton loading={loading} testID="next" disabled={nextButtonDisabled()} onPress={handleNext}>
              Next
            </BaseButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SendReceiver;

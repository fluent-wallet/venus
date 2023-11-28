import { useMemo, useState } from 'react';
import { SafeAreaView, View, KeyboardAvoidingView, Image, TextInput, Pressable } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import { shortenAddress } from '@core/utils/address';
import { Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { type StackNavigation, RootStackList, TransactionConfirmStackName, SendToStackName } from '@router/configs';
import { BaseButton } from '@components/Button';
import { TokenType, transactionAtom } from '@hooks/useTransaction';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';

const SendTo: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof SendToStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [value, setValue] = useState('0');
  const [error, setError] = useState(false);

  const [tx, setTx] = useAtom(transactionAtom);

  const accountBalance = useMemo(
    () => (tx.tokenType === TokenType.ERC20 || tx.tokenType === TokenType.NATIVE ? formatUnits(tx.balance, tx.decimals) : tx.balance),
    [tx.tokenType, tx.balance, tx.decimals]
  );

  const handleChange = (v: string) => {
    setError(false);
    setValue(v);
  };

  const handleNext = () => {
    const val = Number(value);
    if (Number.isNaN(val) || val === 0 || val > Number(accountBalance)) {
      return setError(true);
    }

    setTx((v) => ({ ...v, amount: val }));
    navigation.navigate(TransactionConfirmStackName);
  };

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md">
          <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
            To
          </Text>
          <View className="flex flex-row items-center">
            <View className="m-2">
              <AvatarIcon width={24} height={24} />
            </View>
            <Text>{shortenAddress(tx.to)}</Text>
            <View className="m-1">
              <CopyAllIcon width={16} height={16} />
            </View>
          </View>
        </View>

        <View className="mt-[13px]">
          <Text className="leading-6 ml-4 my-2">Amount</Text>
          <View
            style={{ backgroundColor: theme.colors.surfaceCard, borderColor: error ? theme.colors.warnErrorPrimary : undefined, borderWidth: 1 }}
            className="flex flex-row items-center rounded-md px-4 py-2"
          >
            <TextInput keyboardType={'numeric'} value={value.toString()} onChangeText={handleChange} className="flex-1" />
            {tx.iconUrl ? <Image source={{ uri: tx.iconUrl }} width={24} height={24} /> : <TokenIconDefault width={24} height={24} />}
          </View>
          <View className="flex flex-row justify-end items-center mt-2">
            <Text className="leading-6">
              Balance: {accountBalance} {tx.symbol}
            </Text>
            <Pressable onPress={() => setValue(accountBalance)} style={{ backgroundColor: theme.colors.surfaceBrand }} className="rounded-lg px-2 py-1 ml-2">
              <Text style={{ color: theme.colors.textPrimary }}>MAX</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-auto mb-6">
          <BaseButton disabled={value === '0' || error} onPress={handleNext}>
            Next
          </BaseButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SendTo;

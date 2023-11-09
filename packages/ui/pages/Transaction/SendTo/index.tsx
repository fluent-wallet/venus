import { Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView, View, KeyboardAvoidingView } from 'react-native';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import { TextInput } from 'react-native';
import { BaseButton } from '@components/Button';
import { TransactionConfirmStackName, type StackNavigation, RootStackList } from '@router/configs';
import { RouteProp } from '@react-navigation/native';
import { shortenAddress } from '@core/utils/address';
import { useState } from 'react';

export const SendToStackName = 'SendTo';

const SendTo: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof SendToStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { address } = route.params;
  const [value, setValue] = useState('0');

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
            <Text>{shortenAddress(address)}</Text>
            <View className="m-1">
              <CopyAllIcon width={16} height={16} />
            </View>
          </View>
        </View>

        <View className="mt-[13px]">
          <Text className="leading-6 ml-4 my-2">Amount</Text>
          <View style={{ backgroundColor: theme.colors.surfaceCard }} className="rounded-md px-4 py-2">
            <TextInput keyboardType={'numeric'} value={value} onChangeText={setValue} />
          </View>
          <Text className="text-right leading-6">Balance: 100,000 CFX</Text>
        </View>

        <View className="mt-auto mb-6">
          <BaseButton disabled={value === '0'} onPress={() => navigation.navigate(TransactionConfirmStackName, { address: route.params.address, value })}>
            Next
          </BaseButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SendTo;

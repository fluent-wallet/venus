import { Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView, View, KeyboardAvoidingView } from 'react-native';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import { TextInput } from 'react-native';
import { BaseButton } from '@components/Button';
import { TransactionConfirmStackName, type StackNavigation } from '@router/configs';

export const SendToStackName = 'SendTo';

const SendTo: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md">
          <Text className="text-base leading-6 font-normal" style={{ color: theme.colors.textSecondary }}>
            To
          </Text>
          <View className="flex flex-row items-center">
            <View className="m-2">
              <AvatarIcon width={24} height={24} />
            </View>
            <Text>0x3172...0974</Text>
            <View className="m-1">
              <CopyAllIcon width={16} height={16} />
            </View>
          </View>
        </View>

        <View className="mt-[13px]">
          <Text className="text-base leading-6 ml-4 my-2 font-normal">Amount</Text>
          <View style={{ backgroundColor: theme.colors.surfaceCard }} className="rounded-md px-4 py-2">
            <TextInput keyboardType={'numeric'} />
          </View>
          <Text className="text-base text-right leading-6 font-normal">Balance: 100,000 CFX</Text>
        </View>

        <View className="mt-auto mb-6">
          <BaseButton onPress={() => navigation.navigate(TransactionConfirmStackName)}>Next</BaseButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SendTo;

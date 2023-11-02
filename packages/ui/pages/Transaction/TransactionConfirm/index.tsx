import { Button, Divider, Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { SafeAreaView, View } from 'react-native';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import Warning from '@assets/icons/warning_2.svg';
import { type StackNavigation } from '@router/configs';

import CloseIcon from '@assets/icons/close.svg';
import SendIcon from '@assets/icons/send.svg';
import { BaseButton } from '@components/Button';

export const TransactionConfirmStackName = 'TransactionConfirm';

const TransactionConfirm: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <View className="flex flex-row p-3 items-center border rounded-lg mb-4" style={{ borderColor: theme.colors.warnErrorPrimary }}>
        <Warning width={16} height={16} />
        <View className="flex-1 ml-2">
          <Text className="text-sm leading-6" style={{ color: theme.colors.warnErrorPrimary }}>
            The available balance is not enough to pay the Gas Cost
          </Text>
        </View>
      </View>
      <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md">
        <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
          From
        </Text>
        <View className="flex flex-row items-center my-2">
          <View className="mr-2">
            <AvatarIcon width={24} height={24} />
          </View>
          <Text>0x3172...0974</Text>
          <View className="m-1">
            <CopyAllIcon width={16} height={16} />
          </View>
        </View>
        <Text className="ml-8 leading-6" style={{ color: theme.colors.textSecondary }}>
          Balance: 100,000 CFX
        </Text>

        <Divider className="my-4" />

        <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
          To
        </Text>
        <View className="flex flex-row items-center my-2">
          <View className="mr-2">
            <AvatarIcon width={24} height={24} />
          </View>
          <Text>0x3172...0974</Text>
          <View className="m-1">
            <CopyAllIcon width={16} height={16} />
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md">
        <View className="flex flex-row justify-between">
          <Text className=" leading-6" style={{ color: theme.colors.textSecondary }}>
            Amount
          </Text>
          <View className="flex">
            <Text style={{ color: theme.colors.textPrimary }} className="text-xl font-bold leading-6">
              100,000 HKDC
            </Text>
            <Text style={{ color: theme.colors.textSecondary }} className="text-right text-sm leading-6">
              ≈$99.00
            </Text>
          </View>
        </View>

        <View className="flex flex-row justify-between">
          <Text className=" eading-6" style={{ color: theme.colors.textSecondary }}>
            Estimate Gas Cost
          </Text>
          <View className="flex">
            <Text style={{ color: theme.colors.textPrimary }} className="text-xl font-bold leading-6">
              0.12 CFX
            </Text>
            <Text style={{ color: theme.colors.textSecondary }} className="text-right text-sm leading-6">
              ≈$0.18
            </Text>
          </View>
        </View>

        <View className="flex flex-row justify-between">
          <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
            Network
          </Text>
          <Text className="leading-6">Conflux eSpace</Text>
        </View>
      </View>

      <View className="flex flex-row items-center mt-auto">
        <Button type="outline" buttonStyle={{ width: 48, height: 48, borderRadius: 40, marginRight: 15 }} onPress={() => navigation.goBack()}>
          <CloseIcon />
        </Button>
        <View className="flex-1">
          <BaseButton>
            <SendIcon color="#fff" width={24} height={24} />
            Send
          </BaseButton>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default TransactionConfirm;

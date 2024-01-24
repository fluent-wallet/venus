import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import plugins from '@core/WalletCore/Plugins';
import CustomText from '@components/Text';
import { WayToInitWalletStackName, HomeStackName, type StackScreenProps } from '@router/configs';

const WayToInitWallet: React.FC<{ navigation: StackScreenProps<typeof WayToInitWalletStackName> }> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start">
      <View className="flex flex-row justify-center items-center my-[28px]">
        <View className="w-1/4 h-[1px] pointer-events-none" style={{ backgroundColor: colors.bgPrimary }} />
        <Text style={{ color: colors.textPrimary }} className="mx-[10px] text-sm">
          or add with
        </Text>
        <CustomText style={{ color: colors.textPrimary }}>or add with</CustomText>
        <View className="w-1/4 h-[1px] pointer-events-none" style={{ backgroundColor: colors.textPrimary }} />
      </View>
    </SafeAreaView>
  );
};

export default WayToInitWallet;

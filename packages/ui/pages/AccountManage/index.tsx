import React from 'react';
import { View, SafeAreaView } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { useTheme } from '@rneui/themed';

export const AccountManageStackName = 'AccountManage';
const AccountManage: React.FC<{ navigation: NavigationProp<any> }> = ({ navigation }) => {
  const { theme } = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.surfaceSecondary }}>
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]"></SafeAreaView>
    </View>
  );
};

export default AccountManage;

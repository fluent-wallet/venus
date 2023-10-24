import React from 'react';
import { View, SafeAreaView } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { useTheme } from '@rneui/themed';
import { withObservablesFromDB } from '@core/DB/react';
import TableName from '@core/DB/TableName';
import { type AccountGroup } from '@core/DB/models/AccountGroup';

export const AccountManageStackName = 'AccountManage';
const AccountManage: React.FC<{ navigation: NavigationProp<any>; accountGroup: AccountGroup }> = ({ navigation, accountGroup }) => {
  const { theme } = useTheme();
  
  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.surfaceSecondary }}>
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]"></SafeAreaView>
    </View>
  );
};

export default withObservablesFromDB([TableName.AccountGroup])(AccountManage);

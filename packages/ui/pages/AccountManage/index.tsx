import React from 'react';
import { View, SafeAreaView, Text } from 'react-native';
import { type NavigationProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@rneui/themed';
import { withObservablesFromDB } from '@DB/react';
import TableName from '@DB/TableName';
import { type AccountGroup } from '@DB/models/AccountGroup';

export const AccountManageStackName = 'AccountManage';

// const AccountItem: React.FC = () => {
//   return (

//     );
// }

const AccountGroupItem: React.FC<{ nickname: string }> = ({ nickname }) => {
  const { theme } = useTheme();
  return (
    <View className="p-[16px] rounded-[8px]" style={{ backgroundColor: theme.colors.surfaceCard }}>
      <Text style={{ color: theme.colors.textPrimary }}>{nickname}</Text>
    </View>
  );
};

const AccountManage: React.FC<{ navigation: NavigationProp<any>; accountGroup: Array<AccountGroup> }> = ({ accountGroup }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}>
      {accountGroup?.map((group) => (
        <AccountGroupItem key={group.id} nickname={group.nickname} />
      ))}
    </SafeAreaView>
  );
};

export default withObservablesFromDB([TableName.AccountGroup])(AccountManage);

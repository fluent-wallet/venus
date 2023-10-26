import React from 'react';
import { View, SafeAreaView, Text } from 'react-native';
import { type NavigationProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Button } from '@rneui/base';
import { useTheme } from '@rneui/themed';
import { withObservablesFromDB } from '@DB/react';
import { type AccountGroup } from '@DB/models/AccountGroup';
import AccountGroupItem from '../AccountGroupItem';

export const AccountManageStackName = 'AccountManage';

const AccountManage: React.FC<{ navigation: NavigationProp<any>; accountGroup: Array<AccountGroup> }> = ({ accountGroup }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <View className="mb-[8px] flex flex-row justify-between items-center">
        <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
          Wallet
        </Text>

        <Button
          titleStyle={{ fontSize: 16, fontWeight: '500', color: theme.colors.surfaceBrand }}
          size="sm"
          type="clear"
          title="Add another wallet"
        />
      </View>
      {accountGroup?.map((_accountGroup) => (
        <AccountGroupItem key={_accountGroup.id} accountGroup={_accountGroup} />
      ))}
    </SafeAreaView>
  );
};

export default withObservablesFromDB(['accountGroup'])(AccountManage);

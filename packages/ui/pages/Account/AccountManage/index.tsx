import React from 'react';
import { View, SafeAreaView, ScrollView, Text } from 'react-native';
import { type NavigationProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Button } from '@rneui/base';
import { useTheme } from '@rneui/themed';
import { withObservablesFromDB } from '@DB/react';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { AddAccountStackName } from '@router/configs';
import AccountGroupItem from '../AccountGroupItem';

export const AccountManageStackName = 'AccountManage';

const AccountManage: React.FC<{ navigation: NavigationProp<any>; accountGroup: Array<AccountGroup> }> = ({ navigation, accountGroup }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start pb-[40px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <View className="px-[24px] mb-[8px] flex flex-row justify-between items-center">
        <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
          Wallets
        </Text>

        <Button
          titleStyle={{ fontSize: 16, fontWeight: '500', color: theme.colors.surfaceBrand }}
          size="sm"
          type="clear"
          title="Add another wallet"
          onPress={() => navigation.navigate(AddAccountStackName)}
        />
      </View>
      <ScrollView className="flex-1 px-[24px] flex flex-col gap-[16px]">
        {accountGroup?.map((_accountGroup) => (
          <AccountGroupItem key={_accountGroup.id} accountGroup={_accountGroup} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default withObservablesFromDB(['accountGroup'])(AccountManage);

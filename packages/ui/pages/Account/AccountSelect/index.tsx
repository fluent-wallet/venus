import React from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import { type NavigationProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@rneui/themed';
import { useAccountGroups } from '@core/WalletCore/Plugins/ReactInject';
import AccountGroupItem from '../AccountGroupItem';

export const AccountSelectStackName = 'AccountSelect';

const AccountSelect: React.FC<{ navigation: NavigationProp<any> }> = () => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  const accountGroups = useAccountGroups();

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start pb-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <ScrollView className="flex-1 px-[24px]">
        {accountGroups?.map((accountGroup, index) => (
          <AccountGroupItem style={{ marginTop: index === 0 ? 0 : 16 }} key={accountGroup.id} accountGroup={accountGroup} enableExpanded enableSelect />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountSelect;

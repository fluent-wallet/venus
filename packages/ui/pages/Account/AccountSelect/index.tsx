import React from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import { type NavigationProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useTheme } from '@rneui/themed';
import { withObservablesFromDB } from '@DB/react';
import { type AccountGroup } from '@DB/models/AccountGroup';
import AccountGroupItem from '../AccountGroupItem';

export const AccountSelectStackName = 'AccountSelect';

const AccountSelect: React.FC<{ navigation: NavigationProp<any>; accountGroup: Array<AccountGroup> }> = ({ accountGroup }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start pb-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <ScrollView className="flex-1 px-[24px]">
        {accountGroup?.map((_accountGroup, index) => (
          <AccountGroupItem style={{ marginTop: index === 0 ? 0 : 16 }} key={_accountGroup.id} accountGroup={_accountGroup} enableExpanded enableSelect />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default withObservablesFromDB(['accountGroup'])(AccountSelect);

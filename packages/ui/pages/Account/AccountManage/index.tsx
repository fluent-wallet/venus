import React from 'react';
import { SafeAreaView } from 'react-native';
import { type NavigationProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
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
      {accountGroup?.map((_accountGroup) => (
        <AccountGroupItem key={_accountGroup.id} accountGroup={_accountGroup} />
      ))}
    </SafeAreaView>
  );
};

export default withObservablesFromDB(['accountGroup'])(AccountManage);

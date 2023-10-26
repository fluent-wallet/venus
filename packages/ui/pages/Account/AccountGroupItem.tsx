import { Text } from 'react-native';
import { useTheme, Card } from '@rneui/themed';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { type Account } from '@DB/models/Account';
import { withObservables } from '@DB/react';
import AccountAddress from './AccountAddress';

const AccountGroupItem: React.FC<{ accountGroup: AccountGroup }> = withObservables(['accountGroup'], ({ accountGroup }: { accountGroup: AccountGroup }) => ({
  accountGroup: accountGroup.observe(),
  accounts: accountGroup.account.observe(),
}))(({ accountGroup, accounts }: { accountGroup: AccountGroup; accounts: Account[] }) => {
  const { theme } = useTheme();
  console.log(accounts)
  return (
    <Card>
      <Text style={{ color: theme.colors.textPrimary }}>{accountGroup.nickname}</Text>
      {accounts.map((account) => (
        <AccountAddress account={account} />
      ))}
    </Card>
  );
});

export default AccountGroupItem;

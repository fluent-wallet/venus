import { Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, Card, Icon } from '@rneui/themed';
import { Button } from '@rneui/base';
import { type Vault } from '@DB/models/Vault';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { type Account } from '@DB/models/Account';
import { withObservables } from '@DB/react';
import useInAsync from '@hooks/useInAsync';
import AccountAddress from './AccountAddress';

const AccountGroupItem: React.FC<{ accountGroup: AccountGroup; style?: StyleProp<ViewStyle> }> = withObservables(
  ['accountGroup'],
  ({ accountGroup }: { accountGroup: AccountGroup }) => ({
    accountGroup: accountGroup.observe(),
    accounts: accountGroup.account.observe(),
    vault: accountGroup.vault.observe(),
  })
)(({ style, vault, accountGroup, accounts }: { vault: Vault; accountGroup: AccountGroup; accounts: Account[]; style?: StyleProp<ViewStyle> }) => {
  const { theme } = useTheme();
  const { inAsync, execAsync: addAccount } = useInAsync(accountGroup.addAccount.bind(accountGroup));

  return (
    <Card containerStyle={style}>
      <Text className="mb-[14px] text-[20px] leading-[24px] font-bold" style={{ color: theme.colors.textPrimary }}>
        {accountGroup.nickname}
      </Text>
      <Card.Divider className="my-0" />

      {accounts.map((account, index) => (
        <AccountAddress style={{ marginTop: index === 0 ? 16 : 24 }} key={account.id} account={account} />
      ))}

      {vault.type === 'hierarchical_deterministic' && (
        <>
          <Card.Divider className="mt-[16px] mb-[12px]" />
          <Button
            titleStyle={{ fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary }}
            size="sm"
            type="clear"
            onPress={() => addAccount()}
            loading={inAsync}
          >
            <Icon name="add" color={theme.colors.textPrimary} size={16} className="mr-[5px]" />
            <Text>Add Account</Text>
          </Button>
        </>
      )}
    </Card>
  );
});

export default AccountGroupItem;

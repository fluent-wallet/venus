/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useEffect, useState } from 'react';
import { Text, TouchableHighlight, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, Card, Icon, ListItem } from '@rneui/themed';
import { Button } from '@rneui/base';
import { type Vault } from '@DB/models/Vault';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { type Account } from '@DB/models/Account';
import { selectAccount, querySelectedAccount } from '@DB/models/Account/service';
import { withObservables, useDatabase } from '@DB/react';
import useInAsync from '@hooks/useInAsync';
import AccountAddress from './AccountAddress';

const AccountGroupItem: React.FC<{
  accountGroup: AccountGroup;
  style?: StyleProp<ViewStyle>;
  enableExpanded?: boolean;
  enableAddNew?: boolean;
  enableSelect?: boolean;
}> = withObservables(['accountGroup'], ({ accountGroup }: { accountGroup: AccountGroup }) => {
  return {
    accountGroup: accountGroup.observe(),
    vault: accountGroup.vault.observe(),
    accounts: accountGroup.account.observe(),
  };
})(
  ({
    style,
    vault,
    accountGroup,
    accounts,
    enableExpanded,
    enableAddNew,
    enableSelect,
  }: {
    vault: Vault;
    accountGroup: AccountGroup;
    accounts: Account[];
    style?: StyleProp<ViewStyle>;
    enableExpanded?: boolean;
    enableAddNew?: boolean;
    enableSelect?: boolean;
  }) => {
    const { theme } = useTheme();
    const { inAsync, execAsync: addAccount } = useInAsync(accountGroup.addAccount.bind(accountGroup));
    const [expanded, setExpanded] = useState(true);
    const [selectedAccountId, setSelectAccountId] = useState<string | null>(null);
    const database = useDatabase();
    useEffect(() => {
      const searchSelectAccount = async () => {
        setSelectAccountId((await querySelectedAccount(database))?.[0]?.id);
      };
      searchSelectAccount();
    }, []);

    return (
      <Card containerStyle={style}>
        {(vault.type === 'hierarchical_deterministic' || vault.type === 'BSIM') && (
          <ListItem.Accordion
            noIcon={!enableExpanded}
            disabled={!enableExpanded}
            isExpanded={expanded}
            onPress={() => {
              setExpanded(!expanded);
            }}
            containerStyle={{ padding: 0, margin: 0, height: 24 }}
            content={
              <Text className="flex-1 text-[20px] leading-[24px] font-bold" style={{ color: theme.colors.textPrimary }}>
                {accountGroup.nickname}
              </Text>
            }
          >
            <Card.Divider className="my-[16px]" />
            {accounts.map((account, index) => (
              <TouchableHighlight
                style={{ marginTop: index === 0 ? 0 : 24 }}
                key={account.id}
                underlayColor={theme.colors.underlayColor}
                disabled={!enableSelect || selectedAccountId === account.id}
                onPress={() => {
                  selectAccount(account);
                  setSelectAccountId(account.id);
                }}
              >
                <AccountAddress account={account} showSelected />
              </TouchableHighlight>
            ))}
            {vault.type === 'hierarchical_deterministic' && enableAddNew && (
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
          </ListItem.Accordion>
        )}
      </Card>
    );
  }
);

export default AccountGroupItem;

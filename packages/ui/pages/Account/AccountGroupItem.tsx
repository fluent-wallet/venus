/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableHighlight, View, type StyleProp, type ViewStyle } from 'react-native';
import clsx from 'clsx';
import { atom, useAtom } from 'jotai';
import { useTheme, Card, Icon, ListItem } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@rneui/base';
import { type Vault } from '@DB/models/Vault';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { type Account } from '@DB/models/Account';
import { selectAccount, createAccount, querySelectedAccount } from '@DB/models/Account/service';
import { createNewBSIMAccount } from '@core/BSIMSDK/service';
import { withObservables, useDatabase } from '@DB/react';
import useInAsync from '@hooks/useInAsync';
import { AccountSettingStackName, GroupSettingStackName, type StackNavigation } from '@router/configs';
import AccountAddress from './AccountAddress';

const selectedAccountIdAtom = atom<string | null>(null);
export const useInitSelectedAccount = () => {
  const database = useDatabase();
  const [_, setSelectAccountId] = useAtom(selectedAccountIdAtom);
  useEffect(() => {
    const searchSelectAccount = async () => {
      setSelectAccountId((await querySelectedAccount(database))?.[0]?.id);
    };
    searchSelectAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

const AccountGroupItem: React.FC<{
  accountGroup: AccountGroup;
  style?: StyleProp<ViewStyle>;
  enableExpanded?: boolean;
  enableAddNew?: boolean;
  enableSelect?: boolean;
  enableLinkToSetting?: boolean;
}> = withObservables(['accountGroup'], ({ accountGroup }: { accountGroup: AccountGroup }) => {
  return {
    accountGroup: accountGroup.observe(),
    vault: accountGroup.vault.observe(),
    accounts: accountGroup.visibleAccounts.observe(),
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
    enableLinkToSetting,
  }: {
    vault: Vault;
    accountGroup: AccountGroup;
    accounts: Account[];
    style?: { opacity: number; backgroundColor?: string };
    enableExpanded?: boolean;
    enableAddNew?: boolean;
    enableSelect?: boolean;
    enableLinkToSetting?: boolean;
  }) => {
    const { theme } = useTheme();

    const _addAccount = useCallback(async () => {
      try {
        if (vault.type === 'hierarchical_deterministic') {
          return await createAccount({ accountGroup });
        } else if (vault.type === 'BSIM') {
          return await createAccount({ accountGroup, ...(await createNewBSIMAccount()) });
        }
      } catch (err) {
        console.log('Add account error', err);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { inAsync, execAsync: addAccount } = useInAsync(_addAccount);
    const [expanded, setExpanded] = useState(true);
    const [selectedAccountId, setSelectAccountId] = useAtom(selectedAccountIdAtom);
    const navigation = useNavigation<StackNavigation>();

    return (
      <TouchableHighlight
        className="rounded-[8px] overflow-hidden"
        style={style}
        underlayColor={theme.colors.underlayColor}
        disabled={enableSelect && vault.isGroup}
        onPress={async () => {
          if (vault.isGroup) {
            if (enableLinkToSetting) {
              navigation.navigate(GroupSettingStackName, { accountGroupId: accountGroup.id });
            }
          } else {
            if (enableSelect) {
              selectAccount(accounts?.[0]);
              setSelectAccountId(accounts?.[0].id);
              navigation.goBack();
            } else if (enableLinkToSetting) {
              navigation.navigate(AccountSettingStackName, { accountId: accounts?.[0].id });
            }
          }
        }}
      >
        <View className={clsx('w-[100%]', vault.isGroup ? 'pt-[16px] pb-[8px]' : 'p-[16px]')} style={{ backgroundColor: theme.colors.surfaceCard }}>
          {vault.isGroup && (
            <ListItem.Accordion
              noIcon={!enableExpanded}
              disabled={!enableExpanded}
              isExpanded={expanded}
              onPress={() => {
                setExpanded(!expanded);
              }}
              containerStyle={{ padding: 0, margin: 0, height: 24, backgroundColor: 'transparent' }}
              style={{ paddingHorizontal: 16 }}
              content={
                <Text className="flex-1 text-[20px] leading-[24px] font-bold" style={{ color: theme.colors.textPrimary }}>
                  {accountGroup.nickname}
                </Text>
              }
            >
              <Card.Divider className="mx-[16px] mt-[16px] mb-[8px]" />
              {accounts?.map((account, index) => (
                <TouchableHighlight
                  className="px-[16px] py-[8px] rounded-[4px] overflow-hidden"
                  style={{ marginTop: index === 0 ? 0 : 8 }}
                  key={account.id}
                  underlayColor={theme.colors.underlayColor}
                  disabled={enableSelect && selectedAccountId === account.id}
                  onPress={() => {
                    if (enableSelect) {
                      selectAccount(account);
                      setSelectAccountId(account.id);
                      navigation.goBack();
                    } else if (enableLinkToSetting) {
                      navigation.navigate(AccountSettingStackName, { accountId: account.id });
                    }
                  }}
                >
                  <AccountAddress account={account} showSelected />
                </TouchableHighlight>
              ))}
              {(vault.type === 'hierarchical_deterministic' || vault.type === 'BSIM' || vault.type === 'hardware') && enableAddNew && (
                <>
                  <Card.Divider className="mx-[16px] mt-[16px] mb-[12px]" />
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

          {!vault.isGroup && accounts?.[0] && <AccountAddress account={accounts?.[0]} showSelected />}
        </View>
      </TouchableHighlight>
    );
  }
);

export default AccountGroupItem;

/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useCallback, useState, useMemo } from 'react';
import { Text, TouchableHighlight, View, Pressable, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import clsx from 'clsx';
import { useTheme, Card, Icon, ListItem } from '@rneui/themed';
import { useVaultOfGroup, useAccountsOfGroup, useCurrentAccount } from '@core/WalletCore/Plugins/ReactInject';
import VaultType from '@core/database/models/Vault/VaultType';
import { type AccountGroup } from '@core/database/models/AccountGroup';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import useInAsync from '@hooks/useInAsync';
import { type StackNavigation, GroupSettingStackName, AccountSettingStackName, HDManageStackName } from '@router/configs';
import AccountAddress from './AccountAddress';

const AccountGroupItem: React.FC<{
  accountGroup: AccountGroup;
  style?: StyleProp<ViewStyle>;
  enableExpanded?: boolean;
  enableAddNew?: boolean;
  enableSelect?: boolean;
  enableLinkToSetting?: boolean;
  showSelected?: boolean;
}> = ({ style, accountGroup, enableExpanded, enableAddNew, enableSelect, enableLinkToSetting, showSelected = true }) => {
  const { theme } = useTheme();

  const currentAccount = useCurrentAccount();
  const vault = useVaultOfGroup(accountGroup.id);
  const allAccounts = useAccountsOfGroup(accountGroup.id);
  const accounts = useMemo(() => allAccounts.filter((account) => !account.hidden), [allAccounts]);

  const _addAccount = useCallback(async () => {
    try {
      const lastIndex = await methods.getAccountGroupLastAccountIndex(accountGroup);
      if (lastIndex >= (vault.type === VaultType.BSIM ? plugins.BSIM.chainLimtCount : 255)) {
        navigation.navigate(HDManageStackName, { accountGroupId: accountGroup.id });
        return;
      }
      if (vault.type === VaultType.HierarchicalDeterministic) {
        return await methods.addAccount({ accountGroup });
      } else if (vault.type === VaultType.BSIM) {
        const list = await plugins.BSIM.getBSIMList();
        const newIndex = (await methods.getAccountGroupLastAccountIndex(accountGroup)) + 1;
        const alreadyCreateAccount = list?.find((item) => item.index === newIndex);
        if (alreadyCreateAccount) {
          return await methods.addAccount({ accountGroup, ...alreadyCreateAccount });
        }
        return await methods.addAccount({ accountGroup, ...(await plugins.BSIM.createNewBSIMAccount()) });
      }
    } catch (err) {
      console.log('Add account error', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { inAsync, execAsync: addAccount } = useInAsync(_addAccount);
  const [expanded, setExpanded] = useState(true);

  const navigation = useNavigation<StackNavigation>();
  return (
    <TouchableHighlight
      testID="accountGroupItemTab"
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
            methods.selectAccount(accounts?.[0].id);
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
            style={{ paddingLeft: 16, paddingRight: !enableExpanded ? 0 : 16 }}
            content={
              <View className="flex-1 flex flex-row ">
                <Text numberOfLines={1} className="leading-[24px] text-[20px] font-bold" style={{ color: theme.colors.textPrimary }}>
                  {accountGroup.nickname}
                </Text>
                {!enableExpanded && (
                  <View className="ml-auto rotate-[-90deg]">
                    <Icon name="keyboard-arrow-down" color={theme.colors.textPrimary} />
                  </View>
                )}
              </View>
            }
          >
            <Card.Divider className="mx-[16px] mt-[16px] mb-[8px]" />
            {accounts?.map((account, index) => (
              <TouchableHighlight
                testID="accountItem"
                className="px-[16px] py-[8px] rounded-[4px] overflow-hidden"
                style={{ marginTop: index === 0 ? 0 : 8 }}
                key={account.id}
                underlayColor={theme.colors.underlayColor}
                disabled={enableSelect && currentAccount?.id === account.id}
                onPress={() => {
                  if (enableSelect) {
                    methods.selectAccount(account.id);
                    navigation.goBack();
                  } else if (enableLinkToSetting) {
                    navigation.navigate(AccountSettingStackName, { accountId: account.id });
                  }
                }}
              >
                <AccountAddress account={account} showSelected={showSelected} />
              </TouchableHighlight>
            ))}
            {((vault.type === 'hierarchical_deterministic' && accounts?.length < 256) ||
              (vault.type === 'BSIM' && accounts?.length < plugins.BSIM.chainLimtCount) ||
              vault.type === 'hardware') &&
              enableAddNew && (
                <>
                  <Card.Divider className="mx-[16px] mt-[16px] mb-[0px]" />
                  <Pressable onPress={() => addAccount()} disabled={inAsync}>
                    <View className="flex flex-row items-center justify-center h-[36px] pt-[8px] w-full rounded-[4px] overflow-hidden">
                      {inAsync && <ActivityIndicator size={22} color={theme.colors.surfaceBrand} />}
                      {!inAsync && (
                        <>
                          <Icon name="add" color={theme.colors.textPrimary} size={16} className="mr-[5px]" />
                          <Text style={{ fontSize: 14, color: theme.colors.textPrimary }}>Add Account</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                </>
              )}
          </ListItem.Accordion>
        )}

        {!vault.isGroup && accounts?.[0] && <AccountAddress account={accounts[0]} showSelected />}
      </View>
    </TouchableHighlight>
  );
};

export default AccountGroupItem;

/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useEffect, useState, Fragment } from 'react';
import { SafeAreaView, View, ScrollView, TouchableHighlight } from 'react-native';
import { switchMap } from 'rxjs';
import { useTheme, Text, ListItem, Input } from '@rneui/themed';
import { useHeaderHeight } from '@react-navigation/elements';
import { Button } from '@rneui/base';
import { BaseButton } from '@components/Button';
import { type AccountGroup } from '@DB/models/AccountGroup';
import { type Vault } from '@DB/models/Vault';
import { type Account } from '@DB/models/Account';
import { observeAccountGroupById } from '@DB/models/AccountGroup/service';
import { withDatabase, withObservables, compose, type Database } from '@DB/react';
import { BackUpStackName, type StackNavigation, type RootStackList } from '@router/configs';
import AccountAddress from '@pages/Account/AccountAddress';

export const GroupSettingStackName = 'GroupSettingStackName';

const GroupSetting: React.FC<{
  navigation: StackNavigation;
}> = compose(
  withDatabase,
  withObservables([], ({ database, route }: { database: Database; route: { params: RootStackList[typeof GroupSettingStackName] } }) => {
    const accountGroup = observeAccountGroupById(database, route.params.accountGroupId);
    return {
      accountGroup,
      accounts: accountGroup.pipe(switchMap((accountGroup) => accountGroup.account.observe())),
      vault: accountGroup.pipe(switchMap((accountGroup) => accountGroup.vault.observe())),
    };
  })
)(({ navigation, vault, accountGroup, accounts }: { navigation: StackNavigation; accountGroup: AccountGroup; vault: Vault; accounts: Array<Account> }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  const GroupTitle = vault.type === 'hierarchical_deterministic' ? 'Seed Group' : 'BSIM Group';
  useEffect(() => {
    navigation.setOptions({ headerTitle: GroupTitle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [groupName, setGroupName] = useState(() => accountGroup.nickname);

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start pb-[24px] px-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <Text className="mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
        Group Name
      </Text>
      <ListItem containerStyle={{ height: 52, paddingVertical: 0 }}>
        <ListItem.Content>
          <Input
            className="text-[16px]"
            containerStyle={{ width: '100%', height: '100%', position: 'relative', paddingHorizontal: 0 }}
            inputContainerStyle={{ width: '100%', height: '100%', borderWidth: 0, borderColor: 'transparent' }}
            placeholder={`Input ${GroupTitle} Name`}
            defaultValue={accountGroup.nickname}
            onChange={(evt) => setGroupName(evt.nativeEvent.text)}
          />
        </ListItem.Content>
      </ListItem>

      {vault.type === 'hierarchical_deterministic' && (
        <>
          <Text className="mt-[16px] mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
            Backup
          </Text>
          <TouchableHighlight className="rounded-[8px] overflow-hidden" onPress={() => navigation.navigate(BackUpStackName, { vaultId: vault.id })}>
            <ListItem containerStyle={{ height: 52, paddingVertical: 0 }}>
              <ListItem.Content>
                <ListItem.Title className="text-[16px]" style={{ color: theme.colors.textPrimary }}>
                  Recovery Seed Phrase
                </ListItem.Title>
              </ListItem.Content>
              <ListItem.Chevron color={theme.colors.textPrimary} />
            </ListItem>
          </TouchableHighlight>
        </>
      )}

      <View className="mt-[16px] mb-[8px] flex flex-row justify-between items-center text-[16px] leading-tight">
        <Text style={{ color: theme.colors.textPrimary }}>HD Wallets</Text>

        <Button
          titleStyle={{ fontSize: 16, color: theme.colors.surfaceBrand }}
          size="sm"
          type="clear"
          title="Manage HD Wallets"
          onPress={() => navigation.navigate('123', { type: 'add' })}
        />
      </View>
      <ScrollView className="flex-1 mb-[20px] rounded-[8px] overflow-hidden">
        <ListItem containerStyle={{ paddingVertical: 8 }}>
          <ListItem.Content>
            {accounts?.map((account, index) => (
              <Fragment key={account.id}>
                {index !== 0 && <View className="w-full h-[1px] my-[8px]" style={{ backgroundColor: theme.colors.borderPrimary }} />}
                <AccountAddress className="w-full flex flex-row gap-[0px] justify-between items-center h-[40px] leading-[40px]" account={account} />
              </Fragment>
            ))}
          </ListItem.Content>
        </ListItem>
      </ScrollView>

      <BaseButton
        className="mx-[16px]"
        disabled={groupName === accountGroup.nickname}
        onPress={async () => {
          await accountGroup.updateName(groupName);
          navigation.goBack();
        }}
      >
        Done
      </BaseButton>
    </SafeAreaView>
  );
});

export default GroupSetting;

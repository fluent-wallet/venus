/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useState } from 'react';
import { SafeAreaView, TouchableHighlight } from 'react-native';
import { switchMap } from 'rxjs';
import { useTheme, Text, ListItem, Input } from '@rneui/themed';
import { BaseButton } from '@components/Button';
import { useHeaderHeight } from '@react-navigation/elements';
import { observeAccountById } from '@DB/models/Account/service';
import { type Account } from '@core/DB/models/Account';
import { type Address } from '@core/DB/models/Address';
import { type Vault } from '@core/DB/models/Vault';
import { withDatabase, withObservables, compose, type Database } from '@DB/react';
import { BackUpStackName, type StackNavigation, type RootStackList } from '@router/configs';

export const AccountSettingStackName = 'AccountSetting';

const AccountSetting: React.FC<{
  navigation: StackNavigation;
}> = compose(
  withDatabase,
  withObservables([], ({ database, route }: { database: Database; route: { params: RootStackList[typeof AccountSettingStackName] } }) => {
    const account = observeAccountById(database, route.params.accountId);
    return {
      account,
      vault: account.pipe(
        switchMap((account) => account.accountGroup.observe()),
        switchMap((accountGroup) => accountGroup.vault.observe())
      ),
      currentNetworkAddress: account.pipe(switchMap((account) => account.currentNetworkAddress)),
    };
  })
)(({ navigation, account, vault, currentNetworkAddress }: { navigation: StackNavigation; account: Account; currentNetworkAddress: Address; vault: Vault }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const [accountName, setAccountName] = useState(() => account.nickname);

  return (
    <SafeAreaView
      className="flex-1 flex flex-col just pb-[24px] px-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
        Address
      </Text>
      <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textSecondary }}>
        {currentNetworkAddress.hex}
      </Text>

      <Text className="mt-[16px] mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
        Account Name
      </Text>
      <ListItem containerStyle={{ height: 52, paddingVertical: 0 }}>
        <ListItem.Content>
          <Input
            className="text-[16px]"
            containerStyle={{ width: '100%', height: '100%', position: 'relative', paddingHorizontal: 0 }}
            inputContainerStyle={{ width: '100%', height: '100%', borderWidth: 0, borderColor: 'transparent' }}
            placeholder={`Input Account Name`}
            defaultValue={account.nickname}
            onChange={(evt) => setAccountName(evt.nativeEvent.text)}
          />
        </ListItem.Content>
      </ListItem>

      {(vault.type === 'hierarchical_deterministic' || vault.type === 'private_key') && (
        <>
          <Text className="mt-[16px] mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
            Backup
          </Text>
          <TouchableHighlight
            className="rounded-[8px] overflow-hidden"
            onPress={async () =>
              navigation.navigate(BackUpStackName, {
                vaultId: vault.id,
                ...(vault.type === 'hierarchical_deterministic'
                  ? {
                      accountIndex: account.index,
                    }
                  : undefined),
              })
            }
          >
            <ListItem containerStyle={{ height: 52, paddingVertical: 0 }}>
              <ListItem.Content>
                <ListItem.Title className="text-[16px]" style={{ color: theme.colors.textPrimary }}>
                  Recovery Private Key
                </ListItem.Title>
              </ListItem.Content>
              <ListItem.Chevron color={theme.colors.textPrimary} />
            </ListItem>
          </TouchableHighlight>
        </>
      )}

      <BaseButton
        containerStyle={{ marginTop: 16 }}
        buttonStyle={{ backgroundColor: theme.colors.surfaceCard }}
        onPress={async () => {
          // navigation.goBack();
        }}
      >
        <Text className="text-[16px] font-medium" style={{ color: theme.colors.error }}>
          Remove Account
        </Text>
      </BaseButton>

      <BaseButton
        containerStyle={{ marginTop: 'auto' }}
        disabled={accountName === account.nickname}
        onPress={async () => {
          await account.updateName(accountName);
          navigation.goBack();
        }}
      >
        Done
      </BaseButton>
    </SafeAreaView>
  );
});

export default AccountSetting;

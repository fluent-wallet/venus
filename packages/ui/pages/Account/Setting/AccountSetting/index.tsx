/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useState } from 'react';
import { SafeAreaView, TouchableHighlight } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { showMessage } from 'react-native-flash-message';
import { useTheme, Text, ListItem, Input, Dialog } from '@rneui/themed';
import VaultType from '@core/database/models/Vault/VaultType';
import { useAccountFromId, useGroupOfAccount, useVaultOfAccount, useCurrentAddressValueOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import { BackUpStackName, type RootStackList } from '@router/configs';
import { BaseButton } from '@components/Button';
import { statusBarHeight } from '@utils/deviceInfo';

export const AccountSettingStackName = 'AccountSetting';

const AccountSetting: React.FC<NativeStackScreenProps<RootStackList, 'AccountSetting'>> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  const account = useAccountFromId(route.params.accountId);
  const accountGroup = useGroupOfAccount(route.params.accountId);
  const vault = useVaultOfAccount(route.params.accountId);
  const currentAddressValue = useCurrentAddressValueOfAccount(route.params.accountId);

  const [accountName, setAccountName] = useState(() => account.nickname);
  const [visibleRemoveAccount, setVisibleRemoveAccount] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 flex flex-col just pb-[24px] px-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: headerHeight + 8 }}
    >
      <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
        Address
      </Text>
      <Text className="text-[16px] leading-tight" style={{ color: theme.colors.textSecondary }}>
        {currentAddressValue}
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

      {(vault.type === VaultType.HierarchicalDeterministic || vault.type === VaultType.PrivateKey) && (
        <>
          <Text className="mt-[16px] mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
            Backup
          </Text>
          <TouchableHighlight
            className="rounded-[8px] overflow-hidden"
            onPress={async () =>
              navigation.navigate(BackUpStackName, {
                accountGroupId: accountGroup.id,
                ...(vault.type === VaultType.HierarchicalDeterministic
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
        onPress={() => {
          if (account.selected) {
            showMessage({
              message: "Selected account can't remove.",
              type: 'warning',
              duration: 1500,
              statusBarHeight,
            });
            return;
          }
          setVisibleRemoveAccount(true);
        }}
      >
        <Text className="text-[16px] font-medium" style={{ color: theme.colors.error }}>
          Remove Account
        </Text>
      </BaseButton>
      <Dialog isVisible={visibleRemoveAccount} onBackdropPress={() => setVisibleRemoveAccount(false)}>
        <Dialog.Title
          title="Confirm to delete this account?"
          titleStyle={{ textAlign: 'center', color: theme.colors.textPrimary, fontSize: 20, lineHeight: 24, fontWeight: 'bold' }}
        />
        <Text style={{ color: theme.colors.textPrimary }} className="mt-[12px] mb-[24px] text-[14px] leading-tight">
          This Action will remove this wallet form the app.
          {'\n\n'}
          App can not restore your wallet, you can restore with its seed phrase / private key.
          {'\n\n'}
          Be sure to back up your wallet, otherwise you will permanently lose it and all assets.
        </Text>
        <Dialog.Actions>
          <Dialog.Button
            title="Confirm"
            onPress={async () => {
              try {
                if (vault.isGroup) {
                  await methods.changeAccountHidden({ account, hidden: true });
                } else {
                  await methods.deleteVault(vault);
                }
                showMessage({
                  message: 'Remove account successfully',
                  type: 'success',
                  duration: 2000,
                  statusBarHeight,
                });
                navigation.goBack();
              } catch (err) {
                showMessage({
                  message: 'Remove account failed',
                  description: String(err ?? ''),
                  type: 'warning',
                  duration: 1500,
                  statusBarHeight,
                });
              } finally {
                setVisibleRemoveAccount(false);
              }
            }}
          />
          <Dialog.Button title="Cancel" onPress={() => setVisibleRemoveAccount(false)} />
        </Dialog.Actions>
      </Dialog>

      <BaseButton
        containerStyle={{ marginTop: 'auto' }}
        disabled={accountName === account.nickname}
        onPress={async () => {
          await methods.updateAccountNickName({ account, nickname: accountName });
          navigation.goBack();
        }}
      >
        Done
      </BaseButton>
    </SafeAreaView>
  );
};

export default AccountSetting;

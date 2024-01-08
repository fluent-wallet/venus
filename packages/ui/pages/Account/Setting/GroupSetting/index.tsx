/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { useEffect, useState, useMemo, Fragment } from 'react';
import { SafeAreaView, View, ScrollView, TouchableHighlight } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { showMessage } from 'react-native-flash-message';
import { useHeaderHeight } from '@react-navigation/elements';
import { Button } from '@rneui/base';
import { useTheme, Text, ListItem, Input, Dialog } from '@rneui/themed';
import VaultType from '@core/database/models/Vault/VaultType';
import { useAccountGroupFromId, useAccountsOfGroup, useVaultOfGroup } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { type RootStackList, BackUpStackName, HDManageStackName } from '@router/configs';
import { BaseButton } from '@components/Button';
import AccountAddress from '@pages/Account/AccountAddress';
import useIsMountedRef from '@hooks/useIsMountedRef';

const GroupSetting: React.FC<NativeStackScreenProps<RootStackList, 'GroupSetting'>> = ({ navigation, route }) => {
  const isMounted = useIsMountedRef();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  const accountGroup = useAccountGroupFromId(route.params.accountGroupId);
  const vault = useVaultOfGroup(route.params.accountGroupId);
  const allAccounts = useAccountsOfGroup(route.params.accountGroupId);
  const accounts = useMemo(() => allAccounts.filter((account) => !account.hidden), [allAccounts]);

  const GroupTitle = vault.type === 'hierarchical_deterministic' ? 'Seed Group' : 'BSIM Group';
  useEffect(() => {
    navigation.setOptions({ headerTitle: GroupTitle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [visibleRemoveGroup, setVisibleRemoveGroup] = useState(false);
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
            testID="groupName"
            className="text-[16px]"
            containerStyle={{ width: '100%', height: '100%', position: 'relative', paddingHorizontal: 0 }}
            inputContainerStyle={{ width: '100%', height: '100%', borderWidth: 0, borderColor: 'transparent' }}
            placeholder={`Input ${GroupTitle} Name`}
            defaultValue={accountGroup.nickname}
            onChange={(evt) => setGroupName(evt.nativeEvent.text)}
          />
        </ListItem.Content>
      </ListItem>

      {vault.type === VaultType.HierarchicalDeterministic && (
        <>
          <Text className="mt-[16px] mb-[8px] text-[16px] leading-tight" style={{ color: theme.colors.textPrimary }}>
            Backup
          </Text>
          <TouchableHighlight
            testID="backup"
            className="rounded-[8px] overflow-hidden"
            onPress={() => navigation.navigate(BackUpStackName, { accountGroupId: route.params.accountGroupId, type: VaultType.HierarchicalDeterministic })}
          >
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
          testID="manageHDWallets"
          titleStyle={{ fontSize: 16, color: theme.colors.surfaceBrand }}
          size="sm"
          type="clear"
          title="Manage HD Wallets"
          onPress={async () => {
            try {
              navigation.navigate(HDManageStackName, { accountGroupId: accountGroup.id });
            } catch (err) {
              console.error('Your reject biometrics.');
            }
          }}
        />
      </View>
      <ScrollView className="flex-1 mb-[20px] rounded-[8px]">
        <ListItem containerStyle={{ paddingVertical: 8 }}>
          <ListItem.Content>
            {accounts?.map((account, index) => (
              <Fragment key={account.id}>
                {index !== 0 && <View className="w-full h-[1px] my-[8px]" style={{ backgroundColor: theme.colors.borderPrimary }} />}
                <AccountAddress
                  className="w-full flex flex-row gap-[0px] justify-between items-center h-[40px] leading-[40px]"
                  nickNameClassName="max-w-[62.5%]"
                  account={account}
                />
              </Fragment>
            ))}
          </ListItem.Content>
        </ListItem>
      </ScrollView>

      <BaseButton
        testID="removeGroup"
        containerStyle={{ marginBottom: 16 }}
        buttonStyle={{ backgroundColor: theme.colors.surfaceCard }}
        onPress={() => {
          const hasAccountSelected = accounts.some((account) => account.selected);
          if (hasAccountSelected) {
            showMessage({
              message: "Selected group can't remove.",
              type: 'warning',
            });
            return;
          }
          setVisibleRemoveGroup(true);
        }}
      >
        <Text className="text-[16px] font-medium" style={{ color: theme.colors.error }}>
          Remove Group
        </Text>
      </BaseButton>
      <Dialog isVisible={visibleRemoveGroup} onBackdropPress={() => setVisibleRemoveGroup(false)}>
        <Dialog.Title
          title="Confirm to delete this group?"
          titleStyle={{ textAlign: 'center', color: theme.colors.textPrimary, fontSize: 20, lineHeight: 24, fontWeight: 'bold' }}
        />
        <Text style={{ color: theme.colors.textPrimary }} className="mt-[12px] mb-[24px] text-[14px] leading-tight">
          This Action will remove this wallet form the app.
          {'\n\n'}
          App can not restore your wallet, you can restore with its seed phrase.
          {'\n\n'}
          Be sure to back up your wallet, otherwise you will permanently lose it and all assets.
        </Text>
        <Dialog.Actions>
          <Dialog.Button
            testID="confirm"
            title="Confirm"
            onPress={async () => {
              try {
                await plugins.Authentication.getPassword();
                await methods.deleteVault(vault);
                showMessage({
                  message: 'Remove Group successfully',
                  type: 'success',
                });
                if (isMounted.current) {
                  navigation.goBack();
                }
              } catch (err) {
                if (plugins.Authentication.containsCancel(String(err))) {
                  return;
                }
                showMessage({
                  message: 'Remove Group failed',
                  description: String(err ?? ''),
                  type: 'warning',
                });
              } finally {
                setVisibleRemoveGroup(false);
              }
            }}
          />
          <Dialog.Button testID="cancel" title="Cancel" onPress={() => setVisibleRemoveGroup(false)} />
        </Dialog.Actions>
      </Dialog>

      <BaseButton
        testID="done"
        disabled={groupName === accountGroup.nickname}
        onPress={async () => {
          await methods.updateAccountGroupNickName({ accountGroup, nickname: groupName });
          navigation.goBack();
        }}
      >
        Done
      </BaseButton>
    </SafeAreaView>
  );
};

export default GroupSetting;

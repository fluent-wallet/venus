import React, { useState, useCallback, useRef, useMemo, useEffect, type MutableRefObject } from 'react';
import { View, Pressable, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { useGroupFromId, useAccountsOfGroup, useVaultOfGroup, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Checkbox from '@components/Checkbox';
import Button from '@components/Button';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { Account } from '@modules/AccountsList';
import { AccountManagementStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';
import DeleteConfirm from './DeleteConfirm';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
  groupId: string | null;
  onDismiss: () => void;
}

const GroupConfig: React.FC<Props> = ({ bottomSheetRef, groupId, navigation, onDismiss }) => {
  const { colors, mode } = useTheme();
  const accountGroup = useGroupFromId(groupId);
  const vault = useVaultOfGroup(groupId);
  const accounts = useAccountsOfGroup(groupId);

  const GroupTitle = useMemo(() => (!vault?.type ? 'Group' : vault?.type === VaultType.HierarchicalDeterministic ? 'Seed Group' : 'BSIM Group'), [vault?.type]);

  const [accountGroupName, setAccountGroupName] = useState(() => accountGroup?.nickname);
  useEffect(() => {
    setAccountGroupName(accountGroup?.nickname);
  }, [accountGroup?.nickname]);

  const handleUpdateAccountNickName = useCallback(async () => {
    if (!accountGroup || !accountGroupName) return;
    await methods.updateAccountGroupNickName({ accountGroup, nickname: accountGroupName });
    bottomSheetRef.current?.dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountGroup, accountGroupName]);

  const deleteBottomSheetRef = useRef<BottomSheetMethods>(null!);

  const handlePressDelete = useCallback(() => {
    if (!accounts || !accounts?.length) return;

    const hasAccountSelected = accounts.some((account) => account.selected);
    if (hasAccountSelected) {
      showMessage({
        message: "Selected Group can't remove.",
        type: 'warning',
      });
    } else {
      deleteBottomSheetRef.current?.present();
    }
  }, [accounts]);

  const handleConfirmDelete = useCallback(async () => {
    if (!vault) return;
    try {
      await plugins.Authentication.getPassword();
      await methods.deleteVault(vault);
      showMessage({
        message: 'Remove Group successfully',
        type: 'success',
      });
      bottomSheetRef.current?.dismiss();
    } catch (err) {
      if (plugins.Authentication.containsCancel(String(err))) {
        return;
      }
      showMessage({
        message: 'Remove Group failed',
        description: String(err ?? ''),
        type: 'warning',
      });
    }
    deleteBottomSheetRef.current?.dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, navigation]);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onDismiss={onDismiss}>
        <View style={styles.container}>
          <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>{GroupTitle}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>Account Name</Text>
          <TextInput
            containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
            showVisible={false}
            value={accountGroupName}
            onChangeText={(newNickName) => setAccountGroupName(newNickName)}
          />
          {vault?.type === VaultType.HierarchicalDeterministic && (
            <>
              <Text style={[styles.description, styles.backupDescription, { color: colors.textSecondary }]}>Backup</Text>
              <Pressable style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}>
                <Text style={[styles.mainText, styles.backupText, { color: colors.textPrimary }]}>Seed Phrase</Text>
                <ArrowRight color={colors.iconPrimary} />
              </Pressable>
            </>
          )}

          <Pressable style={({ pressed }) => [styles.HDManage, { backgroundColor: pressed ? colors.underlay : 'transparent' }]} onPress={handlePressDelete}>
            <Text style={[styles.HDManageText, { color: colors.textSecondary }]}>HD Wallets</Text>
            <Text style={[styles.HDManageText, styles.management, { color: colors.textNotice }]}>Management</Text>
          </Pressable>

          <FlatList
            style={styles.accountsContainer}
            data={accounts}
            renderItem={({ item }) => <Account {...item} colors={colors} mode={mode} type="management" isCurrent={false} />}
          />

          <Pressable
            style={({ pressed }) => [styles.row, styles.removeContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={handlePressDelete}
          >
            <Checkbox checked={mode === 'dark'} Icon={Delete} />
            <Text style={[styles.mainText, styles.removeText, { color: colors.textPrimary }]}>Remove Group</Text>
          </Pressable>

          <Button
            style={styles.btn}
            mode="auto"
            disabled={!accountGroupName || accountGroupName === accountGroup?.nickname}
            onPress={handleUpdateAccountNickName}
          >
            OK
          </Button>
        </View>
      </BottomSheet>
      <DeleteConfirm bottomSheetRef={deleteBottomSheetRef} navigation={navigation} onConfirm={handleConfirmDelete} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: 24,
    lineHeight: 40,
    textAlign: 'center',
  },
  mainText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  description: {
    marginBottom: 16,
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  HDManage: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  HDManageText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  accountsContainer: {
    flexGrow: 0,
  },
  management: {
    fontWeight: '600',
    marginLeft: 'auto',
  },
  address: {
    marginBottom: 32,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  textinput: {
    marginBottom: 32,
    marginHorizontal: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
  },
  backupDescription: {
    marginBottom: 10,
  },
  backupText: {
    marginLeft: 16,
    marginRight: 12,
  },
  removeContainer: {
    marginVertical: 16,
  },
  removeText: {
    marginLeft: 8,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 40,
    marginHorizontal: 16,
  },
});

const snapPoints = ['90%'];

export default GroupConfig;

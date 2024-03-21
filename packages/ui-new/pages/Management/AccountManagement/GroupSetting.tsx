import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { useGroupFromId, useAccountsOfGroupInManage, useVaultOfGroup, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Checkbox from '@components/Checkbox';
import Button from '@components/Button';
import BottomSheet, { snapPoints, BottomSheetView, BottomSheetScrollView } from '@components/BottomSheetNew';
import { AccountItemView } from '@modules/AccountsList';
import { GroupSettingStackName, HDSettingStackName, BackupStackName, BackupStep1StackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';
import DeleteConfirm from './DeleteConfirm';

const GroupConfig: React.FC<StackScreenProps<typeof GroupSettingStackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const accountGroup = useGroupFromId(route.params.groupId);
  const vault = useVaultOfGroup(route.params.groupId);
  const accounts = useAccountsOfGroupInManage(route.params.groupId);

  const GroupTitle = useMemo(() => (!vault?.type ? 'Group' : vault?.type === VaultType.HierarchicalDeterministic ? 'Seed Group' : 'BSIM Group'), [vault?.type]);

  const [accountGroupName, setAccountGroupName] = useState(() => accountGroup?.nickname);
  useEffect(() => {
    setAccountGroupName(accountGroup?.nickname);
  }, [accountGroup?.nickname]);

  const handleUpdateAccountGroupNickName = useCallback(async () => {
    if (!accountGroup || !accountGroupName) return;
    await methods.updateAccountGroupNickName({ accountGroup, nickname: accountGroupName });
    navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountGroup, accountGroupName]);

  const [showDeleteBottomSheet, setShowDeleteBottomSheet] = useState(() => false);

  const handlePressDelete = useCallback(() => {
    if (!accounts || !accounts?.length) return;

    const hasAccountSelected = accounts.some((account) => account.selected);
    if (hasAccountSelected) {
      showMessage({
        message: "Selected Group can't remove.",
        type: 'warning',
      });
    } else {
      setShowDeleteBottomSheet(true);
    }
  }, [accounts]);

  const handleConfirmDelete = useCallback(async () => {
    setShowDeleteBottomSheet(false);
    if (!vault) return;
    try {
      await plugins.Authentication.getPassword();
      await methods.deleteVault(vault);
      showMessage({
        message: 'Remove Group successfully',
        type: 'success',
      });
      navigation.goBack();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, navigation]);

  const handleBackupSeedPhrase = useCallback(() => {
    navigation.navigate(BackupStackName, { screen: BackupStep1StackName, params: { groupId: route.params.groupId } });
  }, [navigation, route.params.groupId]);

  const handleChangeBSIMPin = useCallback(() => {
    plugins.BSIM.updateBPIN();
  }, []);

  const renderByVaultType = useCallback(
    <A, B>(HD: A, BSIM: B): A | B => {
      const type = vault?.type;
      if (type === VaultType.HierarchicalDeterministic) return HD;
      return BSIM;
    },
    [vault?.type],
  );

  return (
    <>
      <BottomSheet snapPoints={snapPoints.large} isRoute>
        <BottomSheetView style={styles.container}>
          <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>{GroupTitle}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>Account Name</Text>
          <TextInput
            containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
            showVisible={false}
            defaultHasValue
            value={accountGroupName}
            onChangeText={(newNickName) => setAccountGroupName(newNickName?.trim())}
            isInBottomSheet
          />
          {(vault?.type === VaultType.HierarchicalDeterministic || vault?.type === VaultType.BSIM) && (
            <>
              <Text style={[styles.description, styles.backupDescription, { color: colors.textSecondary }]}>
                {renderByVaultType('Backup', 'BSIM Card Settings')}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                onPress={renderByVaultType(handleBackupSeedPhrase, handleChangeBSIMPin)}
              >
                <Text style={[styles.mainText, styles.backupText, { color: colors.textPrimary }]}>{renderByVaultType('Seed Phrase', 'Change BSIM Code')}</Text>
                <ArrowRight color={colors.iconPrimary} />
              </Pressable>
            </>
          )}

          <Pressable
            style={({ pressed }) => [styles.HDManage, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={() => navigation.navigate(HDSettingStackName, { groupId: route.params.groupId })}
          >
            <Text style={[styles.HDManageText, { color: colors.textSecondary }]}>HD Wallets</Text>
            <Text style={[styles.HDManageText, styles.management, { color: colors.textNotice }]}>Management</Text>
          </Pressable>

          <BottomSheetScrollView style={styles.accountsContainer}>
            {accounts?.map((account) => (
              <AccountItemView key={account.id} nickname={account.nickname} addressValue={account.addressValue} colors={colors} mode={mode} />
            ))}
          </BottomSheetScrollView>

          <Pressable
            style={({ pressed }) => [styles.row, styles.removeContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={handlePressDelete}
          >
            <Checkbox checked={mode === 'dark'} Icon={Delete} />
            <Text style={[styles.mainText, styles.removeText, { color: colors.textPrimary }]}>Remove Group</Text>
          </Pressable>

          <Button style={styles.btn} disabled={!accountGroupName || accountGroupName === accountGroup?.nickname} onPress={handleUpdateAccountGroupNickName}>
            OK
          </Button>
        </BottomSheetView>
      </BottomSheet>
      {showDeleteBottomSheet && <DeleteConfirm onConfirm={handleConfirmDelete} onClose={() => setShowDeleteBottomSheet(false)} />}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    marginBottom: 24,
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

export default GroupConfig;

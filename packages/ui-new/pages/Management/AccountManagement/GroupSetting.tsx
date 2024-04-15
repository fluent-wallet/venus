import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Keyboard, type TextInput as _TextInput } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { useGroupFromId, useAccountsOfGroupInManage, useVaultOfGroup, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import Button from '@components/Button';
import BottomSheet, { snapPoints, BottomSheetScrollView, type BottomSheetMethods } from '@components/BottomSheet';
import { AccountItemView } from '@modules/AccountsList';
import { GroupSettingStackName, HDSettingStackName, BackupStackName, BackupStep1StackName, type StackScreenProps } from '@router/configs';
import useInAsync from '@hooks/useInAsync';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';
import DeleteConfirm from './DeleteConfirm';
import { useTranslation } from 'react-i18next';

const GroupConfig: React.FC<StackScreenProps<typeof GroupSettingStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const textinputRef = useRef<_TextInput>(null!);
  const { t } = useTranslation();

  const accountGroup = useGroupFromId(route.params.groupId);
  const vault = useVaultOfGroup(route.params.groupId);
  const accounts = useAccountsOfGroupInManage(route.params.groupId);

  const GroupTitle = useMemo(
    () => (!vault?.type ? 'Group' : vault?.type === VaultType.HierarchicalDeterministic ? t('account.group.title.seed') : t('account.group.title.BSIM')),
    [vault?.type],
  );

  const [accountGroupName, setAccountGroupName] = useState(() => accountGroup?.nickname);
  useEffect(() => {
    setAccountGroupName(accountGroup?.nickname);
  }, [accountGroup?.nickname]);

  const handleUpdateAccountGroupNickName = useCallback(async () => {
    if (!accountGroup || !accountGroupName) return;
    await methods.updateAccountGroupNickName({ accountGroup, nickname: accountGroupName });
    bottomSheetRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountGroup, accountGroupName]);

  const [showDeleteBottomSheet, setShowDeleteBottomSheet] = useState(() => false);

  const handlePressDelete = useCallback(() => {
    if (!accounts || !accounts?.length) return;

    const hasAccountSelected = accounts.some((account) => account.selected);
    if (hasAccountSelected) {
      showMessage({
        message: t('account.group.remove.error'),
        type: 'warning',
      });
    } else {
      setShowDeleteBottomSheet(true);
      textinputRef.current?.blur();
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
    }
  }, [accounts]);

  const _handleConfirmDelete = useCallback(async () => {
    if (!vault) return;
    try {
      await plugins.Authentication.getPassword();
      await methods.deleteVault(vault);
      showMessage({
        message: t('account.group.remove.success'),
        type: 'success',
      });
      setTimeout(() => bottomSheetRef.current?.close());
      setShowDeleteBottomSheet(false);
    } catch (err) {
      if (plugins.Authentication.containsCancel(String(err))) {
        return;
      }
      showMessage({
        message: t('account.group.remove.errorUnknown'),
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

  const { inAsync: inDeleting, execAsync: handleConfirmDelete } = useInAsync(_handleConfirmDelete);
  const inDelete = showDeleteBottomSheet || inDeleting;

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.large} isRoute>
        <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>{GroupTitle}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.group.inputLabel')}</Text>
        <TextInput
          ref={textinputRef}
          containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
          showVisible={false}
          defaultHasValue
          value={accountGroupName}
          onChangeText={(newNickName) => setAccountGroupName(newNickName?.trim())}
          isInBottomSheet
          disabled={inDelete}
        />
        {(vault?.type === VaultType.HierarchicalDeterministic || vault?.type === VaultType.BSIM) && (
          <>
            <Text style={[styles.description, styles.backupDescription, { color: colors.textSecondary }]}>
              {renderByVaultType(t('common.backup'), t('account.group.settings.BSIM'))}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              onPress={renderByVaultType(handleBackupSeedPhrase, handleChangeBSIMPin)}
              testID="action"
              disabled={inDelete}
            >
              <Text style={[styles.mainText, styles.backupText, { color: colors.textPrimary }]}>
                {renderByVaultType(t('common.seedPhrase'), t('account.group.settings.BSIMCode'))}
              </Text>
              <ArrowRight color={colors.iconPrimary} />
            </Pressable>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.HDManage, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={() => navigation.navigate(HDSettingStackName, { groupId: route.params.groupId })}
          testID="HDManage"
          disabled={inDelete}
        >
          <Text style={[styles.HDManageText, { color: colors.textSecondary }]}>{t('common.HDWallets')}</Text>
          <Text style={[styles.HDManageText, styles.management, { color: colors.textNotice }]}>{t('account.action.ManageMent')}</Text>
        </Pressable>

        <BottomSheetScrollView style={styles.accountsContainer}>
          {accounts?.map((account) => <AccountItemView key={account.id} nickname={account.nickname} addressValue={account.addressValue} colors={colors} />)}
        </BottomSheetScrollView>

        <Pressable
          style={({ pressed }) => [styles.row, styles.removeContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={handlePressDelete}
          testID="remove"
          disabled={inDelete}
        >
          <Checkbox checked Icon={Delete} pointerEvents="none" />
          <Text style={[styles.mainText, styles.removeText, { color: colors.textPrimary }]}>{t('account.group.action.remove')}</Text>
          {inDelete && <HourglassLoading style={styles.deleteLoading} />}
        </Pressable>

        <Button
          testID="ok"
          style={styles.btn}
          disabled={inDelete || !accountGroupName || accountGroupName === accountGroup?.nickname}
          onPress={handleUpdateAccountGroupNickName}
          size="small"
        >
          {t('common.ok')}
        </Button>
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
  deleteLoading: {
    marginLeft: 'auto',
    width: 20,
    height: 20,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 40,
    marginHorizontal: 16,
  },
});

export default GroupConfig;

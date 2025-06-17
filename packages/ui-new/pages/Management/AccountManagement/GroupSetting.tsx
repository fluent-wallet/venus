import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';
import Settings from '@assets/icons/settings.svg';
import BottomSheet, {
  snapPoints,
  BottomSheetWrapper,
  BottomSheetScrollContent,
  BottomSheetHeader,
  BottomSheetFooter,
  type BottomSheetMethods,
} from '@components/BottomSheet';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { VaultType, useAccountsOfGroupInManage, useGroupFromId, useVaultOfGroup } from '@core/WalletCore/Plugins/ReactInject';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import { useTheme } from '@react-navigation/native';
import { BackupStackName, BackupStep1StackName, type GroupSettingStackName, HDSettingStackName, type StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, type TextInput as _TextInput } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import DeleteConfirm from './DeleteConfirm';
import { isAuthenticationCanceledError, isAuthenticationError } from '@WalletCoreExtends/Plugins/Authentication/errors';

const GroupConfig: React.FC<StackScreenProps<typeof GroupSettingStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const textinputRef = useRef<_TextInput>(null!);

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
    const trimedAccountGroupName = accountGroupName?.trim();
    if (!accountGroup || !trimedAccountGroupName) return;
    await methods.updateAccountGroupNickName({ accountGroup, nickname: trimedAccountGroupName });
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
      await plugins.WalletConnect.removeSessionByAddress(accounts.map((v) => v.addressValue));
      showMessage({
        message: t('account.group.remove.success'),
        type: 'success',
      });
      setShowDeleteBottomSheet(false);
      setTimeout(() => bottomSheetRef.current?.close());
    } catch (err) {
      if (isAuthenticationError(err) && isAuthenticationCanceledError(err)) {
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
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints.large}
        isRoute
        enablePanDownToClose={!inDelete}
        enableContentPanningGesture={!inDelete}
        enableHandlePanningGesture={!inDelete}
      >
        <BottomSheetWrapper innerPaddingHorizontal>
          <BottomSheetHeader title={GroupTitle}>
            <Text style={[styles.description, { marginTop: 22, color: colors.textSecondary }]}>{t('account.group.inputLabel')}</Text>
            <TextInput
              ref={textinputRef}
              containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
              showVisible={false}
              defaultHasValue
              value={accountGroupName}
              onChangeText={(newNickName) => setAccountGroupName(newNickName)}
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
                  <ArrowRight color={colors.iconPrimary} width={16} height={16} style={{ transform: [{ translateY: -1 }] }} />
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
              <Settings color={colors.textSecondary} />
            </Pressable>
          </BottomSheetHeader>
          <BottomSheetScrollContent>
            {accounts?.map((account) => (
              <AccountItemView key={account.id} nickname={account.nickname} addressValue={account.addressValue} colors={colors} />
            ))}
          </BottomSheetScrollContent>
          <BottomSheetFooter>
            <Pressable
              style={({ pressed }) => [styles.row, styles.removeContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              onPress={handlePressDelete}
              testID="remove"
              disabled={inDelete}
            >
              <Delete color={colors.textPrimary} width={24} height={24} />
              <Text style={[styles.mainText, { color: colors.textPrimary }]}>{t('account.group.action.remove')}</Text>
              {inDelete && <HourglassLoading style={styles.deleteLoading} />}
            </Pressable>

            <Button
              testID="ok"
              disabled={inDelete || !accountGroupName?.trim() || accountGroupName === accountGroup?.nickname}
              onPress={handleUpdateAccountGroupNickName}
              size="small"
            >
              {t('common.ok')}
            </Button>
          </BottomSheetFooter>
        </BottomSheetWrapper>
      </BottomSheet>
      {showDeleteBottomSheet && <DeleteConfirm onConfirm={handleConfirmDelete} onClose={() => setShowDeleteBottomSheet(false)} />}
    </>
  );
};

const styles = StyleSheet.create({
  mainText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  description: {
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  HDManage: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginTop: 10,
  },
  HDManageText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
    marginRight: 'auto',
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
  },
  textinput: {
    marginBottom: 32,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  backupDescription: {
    marginBottom: 10,
  },
  backupText: {
    marginLeft: 16,
    marginRight: 8,
  },
  removeContainer: {
    marginBottom: 16,
  },
  deleteLoading: {
    marginLeft: 'auto',
    width: 20,
    height: 20,
  },
});

export default GroupConfig;

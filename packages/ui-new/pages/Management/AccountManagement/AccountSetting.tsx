import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { useAccountFromId, useCurrentAddressValueOfAccount, useVaultOfAccount, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import { zeroAddress } from '@core/utils/address';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Checkbox from '@components/Checkbox';
import Button from '@components/Button';
import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import { AccountSettingStackName, BackupStackName, BackupStep1StackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';
import DeleteConfirm from './DeleteConfirm';
import { useTranslation } from 'react-i18next';

const AccountConfig: React.FC<StackScreenProps<typeof AccountSettingStackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  const account = useAccountFromId(route.params.accountId);
  const vault = useVaultOfAccount(route.params.accountId);
  const addressValue = useCurrentAddressValueOfAccount(route.params.accountId);

  const [accountName, setAccountName] = useState(() => account?.nickname);
  useEffect(() => {
    setAccountName(account?.nickname);
  }, [account?.nickname]);

  const handleUpdateAccountNickName = useCallback(async () => {
    if (!account || !accountName) return;
    await methods.updateAccountNickName({ account, nickname: accountName });
    bottomSheetRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, accountName]);

  const [showDeleteBottomSheet, setShowDeleteBottomSheet] = useState(() => false);

  const handlePressDelete = useCallback(() => {
    if (!account) return;
    if (account.selected) {
      showMessage({
        message: t('account.remove.error.removeInUse'),
        type: 'warning',
      });
    } else {
      console.log('handlePressDelete');
      setShowDeleteBottomSheet(true);
    }
  }, [account]);

  const handleConfirmDelete = useCallback(async () => {
    if (!account || !vault) return;
    try {
      if (vault.isGroup) {
        await methods.changeAccountHidden({ account, hidden: true });
      } else {
        await plugins.Authentication.getPassword();
        await methods.deleteVault(vault);
      }
      showMessage({
        message: t('account.remove.successfully'),
        type: 'success',
      });
      setTimeout(() => bottomSheetRef.current?.close());
      setShowDeleteBottomSheet(false);
    } catch (err) {
      if (plugins.Authentication.containsCancel(String(err))) {
        return;
      }
      showMessage({
        message: t('account.remove.error.failed'),
        description: String(err ?? ''),
        type: 'warning',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, vault, navigation]);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.large} isRoute>
        <View style={styles.container}>
          <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>{t('account.detail.title')}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.detail.address')}</Text>
          <Text style={[styles.address, styles.mainText, { color: colors.textPrimary, opacity: addressValue ? 1 : 0 }]}>{addressValue || zeroAddress}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.detail.accountName')}</Text>
          <TextInput
            containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
            showVisible={false}
            defaultHasValue
            value={accountName}
            onChangeText={(newNickName) => setAccountName(newNickName?.trim())}
            isInBottomSheet
          />
          {(vault?.type === VaultType.HierarchicalDeterministic || vault?.type === VaultType.PrivateKey) && (
            <>
              <Text style={[styles.description, styles.backupDescription, { color: colors.textSecondary }]}>{t('common.backup')}</Text>
              <Pressable
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                onPress={() => navigation.navigate(BackupStackName, { screen: BackupStep1StackName, params: { accountId: route.params.accountId } })}
                testID="privateKey"
              >
                <Text style={[styles.mainText, styles.backupText, { color: colors.textPrimary }]}>{t('common.privateKey')}</Text>
                <ArrowRight color={colors.iconPrimary} />
              </Pressable>
            </>
          )}
          <Pressable
            style={({ pressed }) => [styles.row, styles.removeContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={handlePressDelete}
            testID="removeAccount"
          >
            <Checkbox checked Icon={Delete} pointerEvents="none" />
            <Text style={[styles.mainText, styles.removeText, { color: colors.textPrimary }]}>{t('account.action.remove')}</Text>
          </Pressable>

          <Button
            testID="ok"
            style={styles.btn}
            disabled={!accountName || accountName === account?.nickname}
            onPress={handleUpdateAccountNickName}
            size="small"
          >
            {t('common.ok')}
          </Button>
        </View>
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
    marginTop: 20,
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

export default AccountConfig;

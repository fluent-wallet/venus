import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';
import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { VaultType, useAccountFromId, useCurrentAddressValueOfAccount, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { zeroAddress } from '@core/utils/address';
import useInAsync from '@hooks/useInAsync';
import { useTheme } from '@react-navigation/native';
import { type AccountSettingStackName, BackupStackName, BackupStep1StackName, type StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, View, type TextInput as _TextInput } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import DeleteConfirm from './DeleteConfirm';

const AccountConfig: React.FC<StackScreenProps<typeof AccountSettingStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const textinputRef = useRef<_TextInput>(null!);

  const account = useAccountFromId(route.params.accountId);
  const vault = useVaultOfAccount(route.params.accountId);
  const addressValue = useCurrentAddressValueOfAccount(route.params.accountId);

  const [accountName, setAccountName] = useState(() => account?.nickname);
  useEffect(() => {
    setAccountName(account?.nickname);
  }, [account?.nickname]);

  const handleUpdateAccountNickName = useCallback(async () => {
    const trimedAccountName = accountName?.trim();
    if (!account || !trimedAccountName) return;
    await methods.updateAccountNickName({ account, nickname: trimedAccountName });
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
      setShowDeleteBottomSheet(true);
      textinputRef.current?.blur();
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const _handleConfirmDelete = useCallback(async () => {
    if (!account || !vault) return;
    try {
      if (vault.isGroup) {
        await methods.changeAccountHidden({ account, hidden: true });
      } else {
        await plugins.Authentication.getPassword();
        await methods.deleteVault(vault);
      }
      if (addressValue) {
        await plugins.WalletConnect.removeSessionByAddress([addressValue]);
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
  }, [account, addressValue, vault, navigation]);

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
        <View style={styles.container}>
          <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>{t('account.detail.title')}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.detail.address')}</Text>
          <Text style={[styles.address, styles.mainText, { color: colors.textPrimary, opacity: addressValue ? 1 : 0 }]}>{addressValue || zeroAddress}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.detail.accountName')}</Text>
          <TextInput
            ref={textinputRef}
            containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
            showVisible={false}
            defaultHasValue
            value={accountName}
            onChangeText={(newNickName) => setAccountName(newNickName)}
            isInBottomSheet
            disabled={inDelete}
          />
          {(vault?.type === VaultType.HierarchicalDeterministic || vault?.type === VaultType.PrivateKey) && (
            <>
              <Text style={[styles.description, styles.backupDescription, { color: colors.textSecondary }]}>{t('common.backup')}</Text>
              <Pressable
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
                onPress={() => navigation.navigate(BackupStackName, { screen: BackupStep1StackName, params: { accountId: route.params.accountId } })}
                testID="privateKey"
                disabled={inDelete}
              >
                <Text style={[styles.mainText, styles.backupText, { color: colors.textPrimary }]}>{t('common.privateKey')}</Text>
                <ArrowRight color={colors.iconPrimary} width={16} height={16} style={{ transform: [{ translateY: -1 }] }} />
              </Pressable>
            </>
          )}
          <Pressable
            style={({ pressed }) => [styles.row, styles.removeContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            onPress={handlePressDelete}
            testID="removeAccount"
            disabled={inDelete}
          >
            <Delete color={colors.textPrimary} width={24} height={24} />
            <Text style={[styles.mainText, { color: colors.textPrimary }]}>{t('account.action.remove')}</Text>
            {inDelete && <HourglassLoading style={styles.deleteLoading} />}
          </Pressable>

          <Button
            testID="ok"
            style={styles.btn}
            disabled={inDelete || !accountName?.trim() || accountName === account?.nickname}
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
    marginRight: 8,
  },
  removeContainer: {
    marginTop: 20,
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

export default AccountConfig;

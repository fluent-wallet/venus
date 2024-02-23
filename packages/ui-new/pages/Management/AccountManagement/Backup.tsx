import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
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
import BottomSheet, { snapPoints, BottomSheetScrollView, type BottomSheetMethods } from '@components/BottomSheet';
import { AccountSettingStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';
import DeleteConfirm from './DeleteConfirm';

const Backup: React.FC<StackScreenProps<typeof AccountSettingStackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
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
    navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, accountName]);

  const deleteBottomSheetRef = useRef<BottomSheetMethods>(null!);

  const handlePressDelete = useCallback(() => {
    if (!account) return;
    if (account.selected) {
      showMessage({
        message: "Selected account can't remove.",
        type: 'warning',
      });
    } else {
      deleteBottomSheetRef.current?.expand();
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
        message: 'Remove account successfully',
        type: 'success',
      });
      navigation.goBack();
    } catch (err) {
      if (plugins.Authentication.containsCancel(String(err))) {
        return;
      }
      showMessage({
        message: 'Remove account failed',
        description: String(err ?? ''),
        type: 'warning',
      });
    }
    deleteBottomSheetRef.current?.dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, vault, navigation]);

  return (
    <BottomSheet snapPoints={snapPoints.large} index={0} isModal={false} onClose={() => navigation.goBack()}>
      <BottomSheetScrollView contentContainerStyle={styles.container}>

        <Button style={styles.btn} mode="auto" disabled={!accountName || accountName === account?.nickname} onPress={handleUpdateAccountNickName}>
          OK
        </Button>
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 80,
    marginHorizontal: 16,
  },
});

export default Backup;

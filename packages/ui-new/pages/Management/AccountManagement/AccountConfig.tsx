import React, { useState, useCallback, type MutableRefObject, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { Image } from 'expo-image';
import methods from '@core/WalletCore/Methods';
import { useAccountFromId, useCurrentAddressValueOfAccount, useVaultOfAccount, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import { zeroAddress } from '@core/utils/address';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Checkbox from '@components/Checkbox';
import Button from '@components/Button';
import BottomSheet, { BottomSheetScrollView, type BottomSheetMethods } from '@components/BottomSheet';
import { AccountManagementStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import Delete from '@assets/icons/delete.svg';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
  accountId: string | null;
  onDismiss: () => void;
}

const AccountConfig: React.FC<Props> = ({ bottomSheetRef, accountId, onDismiss }) => {
  const { colors, mode } = useTheme();
  const account = useAccountFromId(accountId);
  const vault = useVaultOfAccount(accountId);
  const addressValue = useCurrentAddressValueOfAccount(accountId);

  const [accountName, setAccountName] = useState(() => account?.nickname);
  useEffect(() => {
    setAccountName(account?.nickname);
  }, [account?.nickname]);

  const handleUpdateAccountNickName = useCallback(async () => {
    if (!account || !accountName) return;
    await methods.updateAccountNickName({ account, nickname: accountName });
    bottomSheetRef.current?.dismiss();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, accountName]);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onDismiss={onDismiss}>
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, styles.mainText, { color: colors.textPrimary }]}>Account</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>Address</Text>
        <Text style={[styles.address, styles.mainText, { color: colors.textPrimary, opacity: addressValue ? 1 : 0 }]}>{addressValue || zeroAddress}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>Account Name</Text>
        <TextInput
          containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
          showVisible={false}
          value={accountName}
          onChangeText={(newNickName) => setAccountName(newNickName)}
        />
        {(vault?.type === VaultType.HierarchicalDeterministic || vault?.type === VaultType.PrivateKey) && (
          <>
            <Text style={[styles.description, styles.backupDescription, { color: colors.textSecondary }]}>Backup</Text>
            <Pressable style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}>
              <Text style={[styles.mainText, styles.backupText, { color: colors.textPrimary }]}>
                {vault.type === VaultType.PrivateKey ? 'Private Key' : 'Seed Phrase'}
              </Text>
              <ArrowRight color={colors.iconPrimary} />
            </Pressable>
          </>
        )}
        <Pressable style={({ pressed }) => [styles.row, styles.removeContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}>
          <Checkbox checked={mode === 'dark'} Icon={Delete} />
          <Text style={[styles.mainText, styles.removeText, { color: colors.textPrimary }]}>Remove Account</Text>
        </Pressable>

        <Button style={styles.btn} mode="auto" disabled={accountName === account?.nickname} onPress={handleUpdateAccountNickName}>
          OK
        </Button>
      </BottomSheetScrollView>
    </BottomSheet>
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
    marginBottom: 80,
    marginHorizontal: 16,
  },
});

const snapPoints = ['90%'];

export default AccountConfig;

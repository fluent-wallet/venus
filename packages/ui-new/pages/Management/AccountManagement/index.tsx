import React, { useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { AccountManagementStackName, AccountSettingStackName, GroupSettingStackName, type StackScreenProps } from '@router/configs';
import AccountsList, { styles as accountListStyles } from '@modules/AccountsList';
import Checkbox from '@components/Checkbox';
import { type BottomSheetMethods } from '@components/BottomSheet';
import Add from '@assets/icons/add.svg';
import Delete from '@assets/icons/delete.svg';
import AddAnotherWallet from './AddAnotherWallet';
import EraseAllWallet from './EraseAllWallet';

const AccountManagement: React.FC<StackScreenProps<typeof AccountManagementStackName>> = ({ navigation }) => {
  const { colors, mode } = useTheme();

  const addAnotherWalletRef = useRef<BottomSheetMethods>(null!);
  const eraseAllWalletRef = useRef<BottomSheetMethods>(null!);

  return (
    <>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Account Management</Text>
        <AccountsList
          type="management"
          onPressAccount={(accountId) => navigation.navigate(AccountSettingStackName, { accountId })}
          onPressGroup={(groupId) => navigation.navigate(GroupSettingStackName, { groupId })}
        />

        <Pressable
          style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={() => addAnotherWalletRef.current?.expand()}
        >
          <Checkbox checked={mode === 'dark'} Icon={Add} />
          <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Add another wallet</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={() => eraseAllWalletRef.current?.expand()}
        >
          <Checkbox checked={mode === 'dark'} Icon={Delete} />
          <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Erase all wallets</Text>
        </Pressable>
      </View>
      <AddAnotherWallet bottomSheetRef={addAnotherWalletRef} navigation={navigation} />
      <EraseAllWallet bottomSheetRef={eraseAllWalletRef} navigation={navigation} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    paddingBottom: 32,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
});

export default AccountManagement;

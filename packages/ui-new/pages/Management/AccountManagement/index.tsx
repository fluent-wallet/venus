import React, { useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { AccountManagementStackName, type StackScreenProps } from '@router/configs';
import AccountsList, { styles as accountListStyles } from '@modules/AccountsList';
import Checkbox from '@components/Checkbox';
import { type BottomSheetMethods } from '@components/BottomSheet';
import Add from '@assets/icons/add.svg';
import Delete from '@assets/icons/delete.svg';
import AddAnotherWallet from './AddAnotherWallet';
import EraseAllWallet from './EraseAllWallet';
import AccountConfig from './AccountConfig';
import GroupConfig from './GroupConfig';

const AccountManagement: React.FC<StackScreenProps<typeof AccountManagementStackName>> = ({ navigation }) => {
  const { colors, mode } = useTheme();

  const addAnotherWalletRef = useRef<BottomSheetMethods>(null!);
  const eraseAllWalletRef = useRef<BottomSheetMethods>(null!);
  const accountConfigRef = useRef<BottomSheetMethods>(null!);
  const groupConfigRef = useRef<BottomSheetMethods>(null!);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  return (
    <>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Account Management</Text>
        <AccountsList
          type="management"
          onPressAccount={(_accountId) => {
            setAccountId(_accountId);
            accountConfigRef.current?.present();
          }}
          onPressGroup={(_groupId) => {
            setGroupId(_groupId);
            groupConfigRef.current?.present();
          }}
        />

        <Pressable
          style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={() => addAnotherWalletRef.current?.present()}
        >
          <Checkbox checked={mode === 'dark'} Icon={Add} />
          <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Add another wallet</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={() => eraseAllWalletRef.current?.present()}
        >
          <Checkbox checked={mode === 'dark'} Icon={Delete} />
          <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>Erase all wallets</Text>
        </Pressable>
      </View>
      <AddAnotherWallet bottomSheetRef={addAnotherWalletRef} navigation={navigation} />
      <EraseAllWallet bottomSheetRef={eraseAllWalletRef} navigation={navigation} />
      <AccountConfig bottomSheetRef={accountConfigRef} navigation={navigation} accountId={accountId} onDismiss={() => setAccountId(null)} />
      <GroupConfig bottomSheetRef={groupConfigRef} navigation={navigation} groupId={groupId} onDismiss={() => setGroupId(null)} />
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

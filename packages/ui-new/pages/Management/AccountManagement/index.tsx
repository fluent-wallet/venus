import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import {
  AccountManagementStackName,
  AccountSettingStackName,
  GroupSettingStackName,
  EraseAllWalletStackName,
  AddAnotherWalletStackName,
  type StackScreenProps,
} from '@router/configs';
import AccountsList, { styles as accountListStyles } from '@modules/AccountsList';
import Checkbox from '@components/Checkbox';
import Add from '@assets/icons/add.svg';
import Delete from '@assets/icons/delete.svg';
import { useTranslation } from 'react-i18next';

const AccountManagement: React.FC<StackScreenProps<typeof AccountManagementStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('account.management.title')}</Text>
      <AccountsList
        type="management"
        onPressAccount={({ accountId }) => navigation.navigate(AccountSettingStackName, { accountId })}
        onPressGroup={(groupId) => navigation.navigate(GroupSettingStackName, { groupId })}
      />

      <Pressable
        style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => navigation.navigate(AddAnotherWalletStackName)}
        testID="addAnotherWallet"
      >
        <Checkbox checked Icon={Add} pointerEvents="none" />
        <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('account.action.addOther')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => navigation.navigate(EraseAllWalletStackName)}
        testID="eraseAllWallets"
      >
        <Checkbox checked Icon={Delete} pointerEvents="none" />
        <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('account.action.eraseAll')}</Text>
      </Pressable>
    </View>
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

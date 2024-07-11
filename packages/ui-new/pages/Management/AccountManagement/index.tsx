import Add from '@assets/icons/add.svg';
import Delete from '@assets/icons/delete.svg';
import Text from '@components/Text';
import AccountsList, { styles as accountListStyles } from '@modules/AccountsList';
import { useTheme } from '@react-navigation/native';
import {
  type AccountManagementStackName,
  AccountSettingStackName,
  AddAnotherWalletStackName,
  EraseAllWalletStackName,
  GroupSettingStackName,
  type StackScreenProps,
} from '@router/configs';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

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
        <Add color={colors.textPrimary} width={24} height={24} />
        <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('account.action.addOther')}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => navigation.navigate(EraseAllWalletStackName)}
        testID="eraseAllWallets"
      >
        <Delete color={colors.textPrimary} width={24} height={24} />
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

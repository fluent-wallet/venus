import Add from '@assets/icons/add.svg';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { BSIM_MANAGEMENT_ACCOUNT_LIMIT } from '@core/hardware/bsim/constants';
import AccountsList, { type AccountPress, styles as accountListStyles } from '@modules/AccountsList';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { StackNavigation } from '@router/configs';
import { getAccountRootKey } from '@service/account';
import { getAccountGroupRootKey, useAccountGroupLastAccountIndex } from '@service/accountGroup';
import { useAccountSections } from '@service/accountSections';
import { getAccountService, type IAccountGroup, VaultType } from '@service/core';
import { useQueryClient } from '@tanstack/react-query';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

const AddAccount: React.FC<IAccountGroup & { colors: ReturnType<typeof useTheme>['colors']; inAdding: boolean; onPress: () => void }> = ({
  colors,
  lastAccountIndex,
  vaultType,
  inAdding,
  onPress,
}) => {
  const { t } = useTranslation();
  const nextIndex = lastAccountIndex + 1;
  const notReachMax =
    (vaultType === VaultType.HierarchicalDeterministic && nextIndex < 256) || (vaultType === VaultType.BSIM && nextIndex < BSIM_MANAGEMENT_ACCOUNT_LIMIT);

  if (vaultType === VaultType.PrivateKey || vaultType === VaultType.PublicAddress || !notReachMax) {
    return <View style={[accountListStyles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />;
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [accountListStyles.row, accountListStyles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={onPress}
        disabled={inAdding}
        testID="addAccount"
      >
        <Add color={colors.textPrimary} width={24} height={24} />
        <Text style={[accountListStyles.manageText, { color: colors.textPrimary }]}>{t('account.action.add')}</Text>
        {inAdding && <HourglassLoading style={accountListStyles.addAccountLoading} />}
      </Pressable>
      <View style={[accountListStyles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />
    </>
  );
};

type Props = {
  onPressAccount: (account: AccountPress) => void;
  onPressGroup: (groupId: string) => void;
};

export default function AccountManagementList({ onPressAccount, onPressGroup }: Props) {
  const { colors } = useTheme();
  const { sections, currentAccountId } = useAccountSections();
  const queryClient = useQueryClient();
  const rootNavigation = useNavigation<StackNavigation>();
  const [inAddingId, setInAddingId] = useState<string | null>(null);
  const getLastIndex = useAccountGroupLastAccountIndex();

  const addAccount = useCallback(
    async ({ id, vaultType }: IAccountGroup) => {
      try {
        setInAddingId(id);
        const lastIndex = await getLastIndex(id);
        const limit = vaultType === VaultType.BSIM ? BSIM_MANAGEMENT_ACCOUNT_LIMIT : 256;
        if (lastIndex + 1 >= limit) {
          return;
        }

        await getAccountService().createNextGroupAccount(id);
        await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
        await queryClient.invalidateQueries({ queryKey: getAccountGroupRootKey() });
      } catch (err) {
        if (handleBSIMHardwareUnavailable(err, rootNavigation)) {
          return;
        }
        console.log('Add account error', err);
      } finally {
        setInAddingId(null);
      }
    },
    [getLastIndex, queryClient, rootNavigation],
  );

  return (
    <View style={styles.container}>
      <AccountsList
        sections={sections}
        currentAccountId={currentAccountId}
        type="management"
        onPressAccount={onPressAccount}
        onPressGroup={onPressGroup}
        renderSectionFooter={({ section: { group } }) => (
          <AddAccount {...group} colors={colors} inAdding={inAddingId === group.id} onPress={() => addAccount(group)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

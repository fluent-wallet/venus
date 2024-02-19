import React, { useState, useCallback, useMemo } from 'react';
import { View, SectionList, Pressable, StyleSheet } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useAccountsManage, useCurrentAccount, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { queryAccountGroupById } from '@core/database/models/AccountGroup/query';
import { shortenAddress } from '@core/utils/address';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import { toDataUrl } from '@utils/blockies';
import BSIMCard from '@assets/icons/bsim-card-noshadow.webp';
import More from '@assets/icons/more-circle.svg';
import Add from '@assets/icons/add.svg';

type ListType = 'selector' | 'management';

interface AccountGroupProps {
  key: string;
  id: string;
  nickname: string;
  vaultType: VaultType;
  accountCount: number;
}

interface AccountProps {
  key: string;
  id: string;
  nickname: string;
  hidden: boolean;
  addressValue: string;
}

const rowHeight = 57;

const AccountGroup: React.FC<AccountGroupProps & { colors: ReturnType<typeof useTheme>['colors']; type: ListType }> = ({
  nickname,
  vaultType,
  colors,
  type,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={type === 'selector' || (vaultType !== VaultType.BSIM && vaultType !== VaultType.HierarchicalDeterministic)}
    >
      {<Image style={styles.groupTypeImage} source={BSIMCard} />}
      <Text style={[styles.groupName, { color: colors.textSecondary }]}>{nickname}</Text>
      {type === 'management' && <Text style={[styles.groupManagement, { color: colors.textNotice }]}>ManageMent</Text>}
    </Pressable>
  );
};

const Account: React.FC<
  AccountProps & { colors: ReturnType<typeof useTheme>['colors']; isCurrent: boolean; type: ListType; mode: 'dark' | 'light'; onSelect?: () => void }
> = ({ id, nickname, addressValue, colors, isCurrent, type, mode, onSelect }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={type === 'selector' && isCurrent}
      onPress={() => {
        if (type === 'selector') {
          methods.selectAccount(id);
          onSelect?.();
        } else {
          console.log();
        }
      }}
    >
      <Image style={styles.accountImage} source={{ uri: toDataUrl(addressValue) }} />
      <View>
        <Text style={[styles.accountName, { color: colors.textPrimary, opacity: nickname ? 1 : 0 }]}>{nickname || 'placeholder'}</Text>
        <Text style={[styles.accountAddress, { color: colors.textSecondary }]}>{shortenAddress(addressValue)}</Text>
      </View>
      {type === 'selector' && isCurrent && <Checkbox style={styles.accountRight} checked={mode === 'dark'} />}
      {type === 'management' && <More style={styles.accountRight} color={colors.textNotice} />}
    </Pressable>
  );
};

const AddAccount: React.FC<
  AccountGroupProps & { colors: ReturnType<typeof useTheme>['colors']; type: ListType; mode: 'dark' | 'light'; inAdding: boolean; onPress: () => void }
> = ({ colors, mode, accountCount, vaultType, inAdding, onPress }) => {
  const notReachMax =
    (vaultType === VaultType.HierarchicalDeterministic && accountCount < 256) || (vaultType === VaultType.BSIM && accountCount < plugins.BSIM.chainLimtCount);

  if ((vaultType !== VaultType.BSIM && vaultType !== VaultType.HierarchicalDeterministic) || !notReachMax)
    return <View style={{ height: 1, backgroundColor: colors.borderThird }} pointerEvents="none" />;
  return (
    <Pressable style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]} onPress={onPress} disabled={inAdding}>
      <Checkbox checked={mode === 'dark'} Icon={Add} />
      <Text style={[styles.manageText, { color: colors.textPrimary }]}>Add Account</Text>
      {inAdding && <HourglassLoading style={styles.addAccountLoading} />}
      <View style={[styles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />
    </Pressable>
  );
};

const AccountsList: React.FC<{ type: ListType; onSelect?: () => void }> = ({ type, onSelect }) => {
  const accountsManage = useAccountsManage();
  const currentAccount = useCurrentAccount();
  const { colors, mode } = useTheme();
  const ListComponent = useMemo(() => (type === 'selector' ? BottomSheetSectionList : SectionList), [type]);

  const [inAddingId, setInAddingId] = useState<string | null>(null);
  const addAccount = useCallback(async ({ id, vaultType }: AccountGroupProps) => {
    try {
      setInAddingId(id);
      const accountGroup = await queryAccountGroupById(id);
      const lastIndex = await methods.getAccountGroupLastAccountIndex(accountGroup);
      if (lastIndex >= (vaultType === VaultType.BSIM ? plugins.BSIM.chainLimtCount : 255)) {
        // navigation.navigate(HDManageStackName, { accountGroupId: accountGroup.id });
        return;
      }
      if (vaultType === VaultType.HierarchicalDeterministic) {
        return await methods.addAccount({ accountGroup });
      } else if (vaultType === VaultType.BSIM) {
        const list = await plugins.BSIM.getBSIMList();
        const newIndex = (await methods.getAccountGroupLastAccountIndex(accountGroup)) + 1;
        const alreadyCreateAccount = list?.find((item) => item.index === newIndex);
        if (alreadyCreateAccount) {
          return await methods.addAccount({ accountGroup, ...alreadyCreateAccount });
        }
        return await methods.addAccount({ accountGroup, ...(await plugins.BSIM.createNewBSIMAccount()) });
      }
    } catch (err) {
      console.log('Add account error', err);
    } finally {
      setInAddingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!accountsManage?.length) return null;
  return (
    <ListComponent
      sections={accountsManage}
      renderSectionHeader={({ section: { title } }) => <AccountGroup {...title} colors={colors} type={type} />}
      renderItem={({ item }) => <Account {...item} colors={colors} type={type} isCurrent={currentAccount?.id === item.id} mode={mode} onSelect={onSelect} />}
      renderSectionFooter={
        type === 'selector'
          ? undefined
          : ({ section: { title } }) => (
              <AddAccount {...title} colors={colors} type={type} mode={mode} inAdding={inAddingId === title.id} onPress={() => addAccount(title)} />
            )
      }
    />
  );
};

export const styles = StyleSheet.create({
  row: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: rowHeight,
    paddingHorizontal: 16,
  },
  groupTypeImage: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  groupName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '300',
  },
  groupManagement: {
    marginLeft: 'auto',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  accountImage: {
    width: 32,
    height: 32,
    borderRadius: 32,
    marginRight: 6,
  },
  accountName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  accountAddress: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '300',
  },
  accountRight: {
    marginLeft: 'auto',
  },
  manageText: {
    marginLeft: 8,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  addAccountLoading: {
    marginLeft: 'auto',
    width: 20,
    height: 20,
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});

export default AccountsList;

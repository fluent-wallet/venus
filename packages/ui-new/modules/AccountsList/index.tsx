import React, { useState, useCallback, useMemo } from 'react';
import { View, SectionList, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
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
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
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

const AccountGroup: React.FC<
  AccountGroupProps & { colors: ReturnType<typeof useTheme>['colors']; type: ListType; onPressGroup?: (groupId: string) => void }
> = ({ id, nickname, vaultType, colors, type, onPressGroup }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        styles.group,
        { backgroundColor: pressed ? colors.underlay : type === 'selector' ? colors.bgFourth : colors.bgPrimary },
      ]}
      disabled={type === 'selector' || vaultType === VaultType.PrivateKey || vaultType === VaultType.PublicAddress}
      onPress={() => onPressGroup?.(id)}
    >
      <Image
        style={styles.groupTypeImage}
        source={vaultType === VaultType.BSIM ? BSIMCardWallet : vaultType === VaultType.HierarchicalDeterministic ? HDWallet : ExistWallet}
      />
      <Text style={[styles.groupName, { color: colors.textSecondary }]}>{vaultType === VaultType.PrivateKey ? 'Imported Private Key' : nickname}</Text>
      {type === 'management' && vaultType !== VaultType.PrivateKey && vaultType !== VaultType.PublicAddress && (
        <Text style={[styles.groupManagement, { color: colors.textNotice }]}>ManageMent</Text>
      )}
    </Pressable>
  );
};

export const AccountItemView: React.FC<{
  colors: ReturnType<typeof useTheme>['colors'];
  mode: 'light' | 'dark';
  showSelect?: boolean;
  showMore?: boolean;
  addressValue: string;
  nickname: string;
  onPress?: () => void;
}> = ({ colors, mode, showSelect, showMore, addressValue, nickname, onPress }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      pointerEvents={!onPress ? 'none' : 'auto'}
      onPress={onPress}
    >
      <Image style={styles.accountImage} source={{ uri: toDataUrl(addressValue) }} />
      <View>
        <Text style={[styles.accountName, { color: colors.textPrimary, opacity: nickname ? 1 : 0 }]}>{nickname || 'placeholder'}</Text>
        <Text style={[styles.accountAddress, { color: colors.textSecondary }]}>{shortenAddress(addressValue)}</Text>
      </View>
      {showSelect && <Checkbox style={styles.accountRight} checked={mode === 'dark'} />}
      {showMore && <More style={styles.accountRight} color={colors.textNotice} />}
    </Pressable>
  );
};

const Account: React.FC<
  AccountProps & {
    colors: ReturnType<typeof useTheme>['colors'];
    isCurrent: boolean;
    type: ListType;
    mode: 'dark' | 'light';
    onPress?: (accountId: string) => void;
  }
> = ({ id, nickname, addressValue, colors, isCurrent, type, mode, onPress }) => {
  return (
    <AccountItemView
      nickname={nickname}
      addressValue={addressValue}
      colors={colors}
      mode={mode}
      showSelect={type === 'selector' && isCurrent}
      showMore={type === 'management'}
      onPress={
        type === 'selector'
          ? isCurrent
            ? undefined
            : () => {
                methods.selectAccount(id);
                onPress?.(id);
              }
          : () => {
              onPress?.(id);
            }
      }
    />
  );
};

const AddAccount: React.FC<
  AccountGroupProps & { colors: ReturnType<typeof useTheme>['colors']; type: ListType; mode: 'dark' | 'light'; inAdding: boolean; onPress: () => void }
> = ({ colors, mode, accountCount, vaultType, inAdding, onPress }) => {
  const notReachMax =
    (vaultType === VaultType.HierarchicalDeterministic && accountCount < 256) || (vaultType === VaultType.BSIM && accountCount < plugins.BSIM.chainLimtCount);

  if (vaultType === VaultType.PrivateKey || vaultType === VaultType.PublicAddress || !notReachMax) {
    return <View style={[styles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />;
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, styles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={onPress}
        disabled={inAdding}
      >
        <Checkbox checked={mode === 'dark'} Icon={Add} />
        <Text style={[styles.manageText, { color: colors.textPrimary }]}>Add Account</Text>
        {inAdding && <HourglassLoading style={styles.addAccountLoading} />}
      </Pressable>
      <View style={[styles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />
    </>
  );
};

const AccountsList: React.FC<{ type: ListType; onPressAccount?: (accountId: string) => void; onPressGroup?: (groupId: string) => void }> = ({
  type,
  onPressAccount,
  onPressGroup,
}) => {
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
      renderSectionHeader={({ section: { title } }) => <AccountGroup {...title} colors={colors} type={type} onPressGroup={onPressGroup} />}
      renderItem={({ item }) => (
        <Account {...item} colors={colors} type={type} isCurrent={currentAccount?.id === item.id} mode={mode} onPress={onPressAccount} />
      )}
      renderSectionFooter={
        type === 'selector'
          ? () => <View pointerEvents="none" style={styles.placeholder} />
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
    height: 64,
    paddingHorizontal: 16,
  },
  placeholder: {
    height: 8,
  },
  group: {
    height: 48,
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
    marginVertical: 12,
    height: 1,
  },
});

export default AccountsList;

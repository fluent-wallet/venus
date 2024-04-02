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
import Copy from '@assets/icons/copy.svg';

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
  showSelect?: boolean;
  showMore?: boolean;
  showCopy?: boolean;
  addressValue: string;
  nickname: string;
  shorten?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}> = ({ colors, showSelect, showMore, addressValue, nickname, children, shorten = true, disabled, showCopy, onPress }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent', position: 'relative', paddingRight: 0 }]}
      pointerEvents={!onPress ? 'none' : 'auto'}
      onPress={onPress}
      disabled={disabled}
    >
      <Image style={styles.accountImage} source={{ uri: toDataUrl(addressValue) }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.accountName, { color: colors.textPrimary, opacity: nickname ? 1 : 0 }]}>{nickname || 'placeholder'}</Text>
        <View style={styles.accountAddressWrapper}>
          <Text
            style={[
              styles.accountAddress,
              {
                color: colors.textSecondary,
                borderRightColor: showCopy ? colors.borderFourth : 'transparent',
                borderRightWidth: showCopy ? 1 : 0,
                paddingRight: showCopy ? 5 : 0,
              },
            ]}
          >
            {shorten ? shortenAddress(addressValue) : addressValue}
          </Text>
          {showCopy && <Copy style={styles.accountAddressCopy} />}
        </View>
      </View>
      {showSelect && <Checkbox style={styles.accountRight} checked pointerEvents="none" />}
      {showMore && <More style={styles.accountRight} color={colors.textNotice} />}
      {children}
    </Pressable>
  );
};

const Account: React.FC<
  AccountProps & {
    colors: ReturnType<typeof useTheme>['colors'];
    isCurrent: boolean;
    type: ListType;
    disabledCurrent?: boolean;
    onPress?: (params: { accountId: string; addressValue: string; isCurrent: boolean }) => void;
  }
> = ({ id, nickname, addressValue, colors, isCurrent, type, disabledCurrent, onPress }) => {
  return (
    <AccountItemView
      nickname={nickname}
      addressValue={addressValue}
      colors={colors}
      showSelect={type === 'selector' && isCurrent}
      showMore={type === 'management'}
      disabled={disabledCurrent && isCurrent}
      onPress={() => onPress?.({ accountId: id, addressValue, isCurrent })}
    />
  );
};

const AddAccount: React.FC<AccountGroupProps & { colors: ReturnType<typeof useTheme>['colors']; type: ListType; inAdding: boolean; onPress: () => void }> = ({
  colors,
  accountCount,
  vaultType,
  inAdding,
  onPress,
}) => {
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
        <Checkbox checked Icon={Add} pointerEvents="none" />
        <Text style={[styles.manageText, { color: colors.textPrimary }]}>Add Account</Text>
        {inAdding && <HourglassLoading style={styles.addAccountLoading} />}
      </Pressable>
      <View style={[styles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />
    </>
  );
};

const AccountsList: React.FC<{
  type: ListType;
  disabledCurrent?: boolean;
  onPressAccount?: (params: { accountId: string; addressValue: string; isCurrent: boolean }) => void;
  onPressGroup?: (groupId: string) => void;
}> = ({ type, disabledCurrent, onPressAccount, onPressGroup }) => {
  const accountsManage = useAccountsManage();
  const currentAccount = useCurrentAccount();
  const { colors } = useTheme();
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
        <Account {...item} colors={colors} type={type} isCurrent={currentAccount?.id === item.id} onPress={onPressAccount} disabledCurrent={disabledCurrent} />
      )}
      renderSectionFooter={
        type === 'selector'
          ? () => <View pointerEvents="none" style={styles.placeholder} />
          : ({ section: { title } }) => (
              <AddAccount {...title} colors={colors} type={type} inAdding={inAddingId === title.id} onPress={() => addAccount(title)} />
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
    paddingRight: 16,
  },
  accountAddressWrapper: {
    marginTop: 4,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountAddress: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '300',
    borderStyle: 'dashed',
  },
  accountAddressCopy: {
    marginHorizontal: 12,
  },
  accountRight: {
    marginLeft: 'auto',
    marginRight: 16,
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

import Add from '@assets/icons/add.svg';
import Copy from '@assets/icons/copy.svg';
import More from '@assets/icons/more.svg';
import Settings from '@assets/icons/settings.svg';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import { BSIM_MANAGEMENT_ACCOUNT_LIMIT } from '@core/hardware/bsim/constants';
import { shortenAddress } from '@core/utils/address';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { StackNavigation } from '@router/configs';
import { getAccountRootKey, useAccounts, useCurrentAccount } from '@service/account';
import { getAccountGroupRootKey, useAccountGroupLastAccountIndex, useAccountGroups } from '@service/accountGroup';
import { getAccountService, VaultType } from '@service/core';
import { useQueryClient } from '@tanstack/react-query';
import { toDataUrl } from '@utils/blockies';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

type ListType = 'selector' | 'management';

interface AccountGroupProps {
  key: string;
  id: string;
  nickname: string;
  vaultId: string;
  vaultType: VaultType;
  accountCount: number;
  lastAccountIndex: number;
}

interface AccountProps {
  key: string;
  id: string;
  nickname: string;
  hidden: boolean;
  addressValue: string;
  index: number;
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
      testID="groupSetting"
    >
      <Image
        style={styles.groupTypeImage}
        source={vaultType === VaultType.BSIM ? BSIMCardWallet : vaultType === VaultType.HierarchicalDeterministic ? HDWallet : ExistWallet}
      />
      <Text style={[styles.groupName, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
        {vaultType === VaultType.PrivateKey ? 'Imported Private Key' : nickname}
      </Text>
      {type === 'management' && vaultType !== VaultType.PrivateKey && vaultType !== VaultType.PublicAddress && (
        <Settings style={styles.groupSettings} color={colors.textSecondary} />
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
  nickname?: string;
  shorten?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  showUnderlay?: boolean;
  innerPaddingHorizontal?: boolean;
}> = ({
  colors,
  showSelect,
  showMore,
  addressValue,
  nickname,
  children,
  shorten = true,
  showUnderlay = true,
  disabled,
  showCopy,
  onPress,
  innerPaddingHorizontal = true,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: showUnderlay && pressed ? colors.underlay : 'transparent',
          position: 'relative',
          paddingLeft: innerPaddingHorizontal ? 16 : 0,
          paddingRight: 0,
        },
      ]}
      pointerEvents={!onPress ? 'none' : 'auto'}
      onPress={onPress}
      disabled={disabled}
    >
      <Image style={styles.accountImage} source={{ uri: toDataUrl(addressValue) }} />
      <View style={{ flex: 1 }}>
        {nickname && (
          <Text style={[styles.accountName, { color: colors.textPrimary, paddingRight: 16 }]} numberOfLines={1}>
            {nickname}
          </Text>
        )}
        <View style={styles.accountAddressWrapper}>
          <Text
            style={[
              styles.accountAddress,
              !nickname && styles.accountName,
              {
                color: nickname ? colors.textSecondary : colors.textPrimary,
                borderRightColor: showCopy ? colors.borderFourth : 'transparent',
                borderRightWidth: showCopy ? 1 : 0,
                paddingRight: showCopy ? 5 : 0,
              },
            ]}
          >
            {shorten ? shortenAddress(addressValue) : addressValue}
          </Text>
          {showCopy && <Copy style={styles.accountAddressCopy} color={colors.textPrimary} />}
        </View>
      </View>
      {showSelect && <Checkbox style={styles.accountRight} checked pointerEvents="none" />}
      {showMore && <More style={styles.accountRight} color={colors.textSecondary} />}
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
    return <View style={[styles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />;
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, styles.group, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={onPress}
        disabled={inAdding}
        testID="addAccount"
      >
        <Add color={colors.textPrimary} width={24} height={24} />
        <Text style={[styles.manageText, { color: colors.textPrimary }]}>{t('account.action.add')}</Text>
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
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { data: currentAccount } = useCurrentAccount();
  const { data: groups = [] } = useAccountGroups(true);
  const { data: accounts = [] } = useAccounts(false);
  const ListComponent = useMemo(() => (type === 'selector' ? BottomSheetSectionList : SectionList), [type]);
  const rootNavigation = useNavigation<StackNavigation>();
  const [inAddingId, setInAddingId] = useState<string | null>(null);
  const getLastIndex = useAccountGroupLastAccountIndex();

  const accountsManage = useMemo(() => {
    const accountsByGroup = new Map<string, AccountProps[]>();
    for (const account of accounts) {
      if (account.hidden) continue;
      const list = accountsByGroup.get(account.accountGroupId);
      const item: AccountProps = {
        key: account.id,
        id: account.id,
        nickname: account.nickname,
        hidden: account.hidden,
        addressValue: account.address,
        index: account.index,
      };
      if (list) list.push(item);
      else accountsByGroup.set(account.accountGroupId, [item]);
    }

    const sections = groups
      .map((group) => {
        const list = accountsByGroup.get(group.id) ?? [];
        return {
          title: {
            key: group.id,
            id: group.id,
            nickname: group.nickname,
            vaultId: group.vaultId,
            vaultType: group.vaultType,
            accountCount: group.accountCount,
            lastAccountIndex: group.lastAccountIndex,
          } satisfies AccountGroupProps,
          data: list.sort((a, b) => a.index - b.index),
        };
      })
      .filter((section) => section.data.length > 0);

    sections.sort((a, b) => {
      const aIsBsim = a.title.vaultType === VaultType.BSIM;
      const bIsBsim = b.title.vaultType === VaultType.BSIM;
      if (aIsBsim === bIsBsim) return 0;
      return aIsBsim ? -1 : 1;
    });
    return sections;
  }, [accounts, groups]);

  const addAccount = useCallback(
    async ({ id, vaultType }: AccountGroupProps) => {
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
      } catch (err: any) {
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

  if (!accountsManage?.length) return null;
  return (
    <ListComponent
      sections={accountsManage}
      renderSectionHeader={({ section: { title } }) => <AccountGroup {...title} key={title.id} colors={colors} type={type} onPressGroup={onPressGroup} />}
      renderItem={({ item }) => (
        <Account
          {...item}
          colors={colors}
          type={type}
          isCurrent={currentAccount?.id === item.id}
          onPress={onPressAccount}
          disabledCurrent={disabledCurrent}
          key={item.id}
        />
      )}
      renderSectionFooter={
        type === 'selector'
          ? () => <View pointerEvents="none" style={styles.placeholder} />
          : ({ section: { title } }) => (
              <AddAccount {...title} key={title.id} colors={colors} type={type} inAdding={inAddingId === title.id} onPress={() => addAccount(title)} />
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
    marginRight: 8,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '300',
  },
  groupSettings: {
    marginLeft: 'auto',
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

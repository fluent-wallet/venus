import Add from '@assets/icons/add.svg';
import Copy from '@assets/icons/copy.svg';
import More from '@assets/icons/more.svg';
import Settings from '@assets/icons/settings.svg';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { VaultType, useAccountsManage, useCurrentAccount } from '@core/WalletCore/Plugins/ReactInject';
import { queryAccountGroupById } from '@core/database/models/AccountGroup/query';
import { shortenAddress } from '@core/utils/address';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { useTheme } from '@react-navigation/native';
import { toDataUrl } from '@utils/blockies';
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
  accountCount,
  vaultType,
  inAdding,
  onPress,
}) => {
  const { t } = useTranslation();
  const notReachMax =
    (vaultType === VaultType.HierarchicalDeterministic && accountCount < 256) || (vaultType === VaultType.BSIM && accountCount < plugins.BSIM.chainLimitCount);

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
  const accountsManage = useAccountsManage();
  const currentAccount = useCurrentAccount();
  const ListComponent = useMemo(() => (type === 'selector' ? BottomSheetSectionList : SectionList), [type]);

  const [inAddingId, setInAddingId] = useState<string | null>(null);
  const addAccount = useCallback(async ({ id, vaultType }: AccountGroupProps) => {
    try {
      setInAddingId(id);
      const accountGroup = await queryAccountGroupById(id);
      const lastIndex = await methods.getAccountGroupLastAccountIndex(accountGroup);
      if (lastIndex >= (vaultType === VaultType.BSIM ? plugins.BSIM.chainLimitCount : 255)) {
        // navigation.navigate(HDManageStackName, { accountGroupId: accountGroup.id });
        return;
      }
      if (vaultType === VaultType.HierarchicalDeterministic) {
        return await methods.addAccount({ accountGroup });
      }
      if (vaultType === VaultType.BSIM) {
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
      renderSectionHeader={({ section: { title } }) => <AccountGroup {...title} key={title.id} colors={colors} type={type} onPressGroup={onPressGroup} />}
      renderItem={({ item }) => (
        <Account {...item} colors={colors} type={type} isCurrent={currentAccount?.id === item.id} onPress={onPressAccount} disabledCurrent={disabledCurrent}  key={item.id}/>
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

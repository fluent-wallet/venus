import React, { useMemo } from 'react';
import { View, SectionList, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { useAccountsManage, useCurrentAccount, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import { shortenAddress } from '@core/utils/address';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import { toDataUrl } from '@utils/blockies';
import BSIMCard from '@assets/icons/bsim-card-noshadow.webp';

type ListType = 'selector' | 'manage';

interface AccountGroupProps {
  key: string;
  id: string;
  nickname: string;
  vaultType: VaultType;
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
    <Pressable style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]} disabled={type === 'selector'}>
      {<Image style={styles.groupTypeImage} source={BSIMCard} />}
      <Text style={[styles.groupName, { color: colors.textSecondary }]}>{nickname}</Text>
    </Pressable>
  );
};

const Account: React.FC<AccountProps & { colors: ReturnType<typeof useTheme>['colors']; isCurrent: boolean; type: ListType; onSelect?: () => void }> = ({
  id,
  nickname,
  addressValue,
  colors,
  isCurrent,
  type,
  onSelect,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={type === 'selector' && isCurrent}
      onPress={() => {
        if (type === 'selector') {
          methods.selectAccount(id);
          onSelect?.();
        } else {
        }
      }}
    >
      <Image style={styles.accountImage} source={{ uri: toDataUrl(addressValue) }} />
      <View>
        <Text style={[styles.accountName, { color: colors.textPrimary, opacity: nickname ? 1 : 0 }]}>{nickname || 'placeholder'}</Text>
        <Text style={[styles.accountAddress, { color: colors.textSecondary }]}>{shortenAddress(addressValue)}</Text>
      </View>
      {isCurrent && <Checkbox style={styles.checkbox} checked={false} />}
    </Pressable>
  );
};

const AccountsList: React.FC<{ type: ListType; onSelect?: () => void }> = ({ type, onSelect }) => {
  const accountsManage = useAccountsManage();
  const currentAccount = useCurrentAccount();

  const { colors } = useTheme();
  const ListComponent = useMemo(() => (type === 'selector' ? BottomSheetSectionList : SectionList), [type]);

  if (!accountsManage?.length) return null;
  return (
    <ListComponent
      sections={accountsManage}
      renderSectionHeader={({ section: { title } }) => <AccountGroup {...title} colors={colors} type={type} />}
      renderItem={({ item }) => <Account {...item} colors={colors} type={type} isCurrent={currentAccount?.id === item.id} onSelect={onSelect} />}
    />
  );
};

const styles = StyleSheet.create({
  row: {
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
  checkbox: {
    marginLeft: 'auto',
  },
});

export default AccountsList;

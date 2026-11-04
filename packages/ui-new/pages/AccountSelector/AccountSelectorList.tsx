import { sheetLayoutStyles } from '@components/Sheet';
import AccountGroupHeader from '@modules/AccountsList/AccountGroupHeader';
import AccountItemView from '@modules/AccountsList/AccountItemView';
import { styles } from '@modules/AccountsList/styles';
import type { AccountSection } from '@service/accountSections';
import type { IAccount, IAccountGroup } from '@service/core';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { Platform, View } from 'react-native';

type AccountListRow =
  | { type: 'group'; key: string; group: IAccountGroup }
  | { type: 'account'; key: string; account: IAccount }
  | { type: 'spacing'; key: string };

type Props = {
  sections: readonly AccountSection[];
  currentAccountId?: string;
  onSelectAccount: (accountId: string) => void;
};

const keyExtractor = (row: AccountListRow) => row.key;
const getItemType = (row: AccountListRow) => row.type;

export default function AccountSelectorList({ sections, currentAccountId, onSelectAccount }: Props) {
  const { rows, groupIndices } = useMemo(() => {
    const rows: AccountListRow[] = [];
    const groupIndices: number[] = [];
    for (const section of sections) {
      groupIndices.push(rows.length);
      rows.push({ type: 'group', key: `group:${section.key}`, group: section.group });
      for (const account of section.data) {
        rows.push({ type: 'account', key: `account:${account.id}`, account });
      }
      rows.push({ type: 'spacing', key: `spacing:${section.key}` });
    }
    return { rows, groupIndices };
  }, [sections]);

  const renderItem = useCallback<ListRenderItem<AccountListRow>>(
    ({ item }) => {
      switch (item.type) {
        case 'group':
          return <AccountGroupHeader {...item.group} type="selector" />;
        case 'account': {
          const isCurrent = item.account.id === currentAccountId;
          return (
            <AccountItemView
              nickname={item.account.nickname}
              addressValue={item.account.address}
              showSelect={isCurrent}
              disabled={isCurrent}
              onPress={() => onSelectAccount(item.account.id)}
            />
          );
        }
        case 'spacing':
          return <View pointerEvents="none" style={styles.placeholder} />;
      }
    },
    [currentAccountId, onSelectAccount],
  );

  return (
    <FlashList
      testID="accountsList"
      data={rows}
      extraData={currentAccountId}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      renderItem={renderItem}
      stickyHeaderIndices={Platform.OS === 'ios' ? groupIndices : undefined}
      style={sheetLayoutStyles.scrollable}
      contentContainerStyle={sheetLayoutStyles.scrollContent}
      nestedScrollEnabled
    />
  );
}

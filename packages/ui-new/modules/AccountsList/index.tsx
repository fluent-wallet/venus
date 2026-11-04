import type { AccountSection } from '@service/accountSections';
import type { IAccount } from '@service/core';
import type React from 'react';
import { useCallback } from 'react';
import { SectionList, type SectionListProps, type SectionListRenderItemInfo, View } from 'react-native';
import AccountGroupHeader from './AccountGroupHeader';
import AccountItemView from './AccountItemView';
import { styles } from './styles';

export { default as AccountItemView } from './AccountItemView';
export { styles } from './styles';

export type AccountPress = { accountId: string; addressValue: string; isCurrent: boolean };

type NativeListProps = SectionListProps<IAccount, AccountSection>;
type Props = Pick<NativeListProps, 'style' | 'contentContainerStyle' | 'nestedScrollEnabled' | 'renderSectionFooter'> & {
  sections: readonly AccountSection[];
  currentAccountId?: string;
  type: 'selector' | 'management';
  disabledCurrent?: boolean;
  onPressAccount?: (account: AccountPress) => void;
  onPressGroup?: (groupId: string) => void;
  ListComponent?: React.ComponentType<NativeListProps>;
};

function renderSectionSpacing() {
  return <View pointerEvents="none" style={styles.placeholder} />;
}

export default function AccountsList({
  sections,
  currentAccountId,
  type,
  disabledCurrent,
  onPressAccount,
  onPressGroup,
  ListComponent = SectionList<IAccount, AccountSection>,
  renderSectionFooter,
  ...listProps
}: Props) {
  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<IAccount, AccountSection>) => {
      const isCurrent = currentAccountId === item.id;
      return (
        <AccountItemView
          nickname={item.nickname}
          addressValue={item.address}
          showSelect={type === 'selector' && isCurrent}
          showMore={type === 'management'}
          disabled={disabledCurrent && isCurrent}
          onPress={() => onPressAccount?.({ accountId: item.id, addressValue: item.address, isCurrent })}
        />
      );
    },
    [currentAccountId, type, disabledCurrent, onPressAccount],
  );

  return (
    <ListComponent
      {...listProps}
      testID="accountsList"
      sections={sections}
      extraData={currentAccountId}
      keyExtractor={(account) => account.id}
      renderSectionHeader={({ section: { group } }) => <AccountGroupHeader {...group} type={type} onPressGroup={onPressGroup} />}
      renderItem={renderItem}
      renderSectionFooter={renderSectionFooter ?? (type === 'selector' ? renderSectionSpacing : undefined)}
    />
  );
}

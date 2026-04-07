import Calendar from '@assets/icons/calendar.svg';
import NoneActivity from '@assets/images/none-activity.webp';
import Text from '@components/Text';
import ActivityItem from '@modules/ActivityList/ActivityItem';
import { type ActivityContentRow, buildActivityContentRows } from '@modules/ActivityList/helpers';
import { styles as noneStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import { useTheme } from '@react-navigation/native';
import { useActivityTransactionsOfCurrentAddress } from '@service/transaction';
import { Image } from 'expo-image';
import type React from 'react';
import { type RefObject, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { type HomeFlashListRef, HomeFlashTabList } from './HomeTabList';

const MONTH_TXT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

export type HomeActivityRow = { key: 'activity-empty'; kind: 'activity-empty' } | ActivityContentRow;

const ActivityEmptyState: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Image style={noneStyles.noneImg} source={NoneActivity} contentFit="contain" />
      <Text style={[noneStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noActivity')}</Text>
    </>
  );
};

const ActivityDateRow: React.FC<{ year: number; month: number; day: number; marginTop: number }> = ({ year, month, day, marginTop }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.dateWrapper, marginTop > 0 && { marginTop }]}>
      <Calendar color={colors.textSecondary} />
      <Text style={[styles.date, { color: colors.textSecondary, borderColor: colors.borderThird }]}>
        {MONTH_TXT[month]} {day},{'  '}
        {year}
      </Text>
    </View>
  );
};

export const HomeActivityTab: React.FC<{
  flatListRef: RefObject<HomeFlashListRef<HomeActivityRow> | null>;
  onPressTx: (txId: string) => void;
  topInset: number;
  onLayoutHeightChange?: (height: number) => void;
  onContentHeightChange?: (height: number) => void;
  scrollOffset: SharedValue<number>;
  sharedScrollY: SharedValue<number>;
  isActive: boolean;
  scrollGesture: GestureType;
}> = ({ flatListRef, onPressTx, topInset, onLayoutHeightChange, onContentHeightChange, scrollOffset, sharedScrollY, isActive, scrollGesture }) => {
  const unfinishedTxsQuery = useActivityTransactionsOfCurrentAddress({ status: 'pending' });
  const finishedTxsQuery = useActivityTransactionsOfCurrentAddress({ status: 'finished' });
  const unfinishedTxs = unfinishedTxsQuery.data ?? [];
  const finishedTxs = finishedTxsQuery.data ?? [];
  const listContentContainerStyle = useMemo(() => ({ paddingTop: topInset + 16, paddingHorizontal: 16 }), [topInset]);

  const contentRows = useMemo<HomeActivityRow[]>(() => {
    const rows = buildActivityContentRows({ finishedTxs, unfinishedTxs });

    if (rows.length === 0) {
      return [{ key: 'activity-empty', kind: 'activity-empty' }];
    }

    return rows;
  }, [finishedTxs, unfinishedTxs]);

  const renderContentItem = useCallback(
    (item: HomeActivityRow) => {
      switch (item.kind) {
        case 'activity-empty':
          return <ActivityEmptyState />;
        case 'activity-date':
          return <ActivityDateRow year={item.year} month={item.month} day={item.day} marginTop={item.marginTop} />;
        case 'activity-item':
          return <ActivityItem tx={item.tx} onPress={onPressTx} />;
        default:
          return null;
      }
    },
    [onPressTx],
  );

  return (
    <HomeFlashTabList
      flatListRef={flatListRef}
      contentRows={contentRows}
      renderContentItem={renderContentItem}
      topInset={topInset}
      contentContainerStyle={listContentContainerStyle}
      onLayoutHeightChange={onLayoutHeightChange}
      onContentHeightChange={onContentHeightChange}
      scrollOffset={scrollOffset}
      sharedScrollY={sharedScrollY}
      isActive={isActive}
      scrollGesture={scrollGesture}
      getItemType={(item) => item.kind}
    />
  );
};

const styles = StyleSheet.create({
  dateWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
    marginLeft: 4,
  },
});

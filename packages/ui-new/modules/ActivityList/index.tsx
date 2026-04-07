import Calendar from '@assets/icons/calendar.svg';
import NoneActivity from '@assets/images/none-activity.webp';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { useActivityTransactionsOfCurrentAddress } from '@service/transaction';
import { Image } from 'expo-image';
import type React from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { styles as noneStyles } from '../AssetsList/TokensList/ReceiveFunds';
import ActivityItem from './ActivityItem';
import { buildActivityContentRows } from './helpers';

const MONTH_TXT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

const ActivityList: React.FC<{ onPress?: (txId: string) => void }> = memo(({ onPress }) => {
  const { colors } = useTheme();
  const unfinishedTxsQuery = useActivityTransactionsOfCurrentAddress({ status: 'pending' });
  const finishedTxsQuery = useActivityTransactionsOfCurrentAddress({ status: 'finished' });
  const unfinishedTxs = unfinishedTxsQuery.data ?? [];
  const finishedTxs = finishedTxsQuery.data ?? [];
  const { t } = useTranslation();

  const contentRows = useMemo(() => buildActivityContentRows({ finishedTxs, unfinishedTxs }), [finishedTxs, unfinishedTxs]);

  if (!contentRows.length) {
    return (
      <>
        <Image style={noneStyles.noneImg} source={NoneActivity} contentFit="contain" />
        <Text style={[noneStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noActivity')}</Text>
      </>
    );
  }

  return (
    <View style={styles.container}>
      {contentRows.map((row) =>
        row.kind === 'activity-date' ? (
          <View style={[styles.dateWrapper, row.marginTop > 0 && { marginTop: row.marginTop }]} key={row.key}>
            <Calendar color={colors.textSecondary} />
            <Text style={[styles.date, { color: colors.textSecondary, borderColor: colors.borderThird }]}>
              {MONTH_TXT[row.month]} {row.day},{'  '}
              {row.year}
            </Text>
          </View>
        ) : (
          <ActivityItem key={row.key} tx={row.tx} onPress={onPress} />
        ),
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
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
  img: {
    alignSelf: 'center',
    width: 120,
    aspectRatio: 1,
    marginTop: 36,
  },
});

export default ActivityList;

import Calendar from '@assets/icons/calendar.svg';
import NoneActivity from '@assets/images/none-activity.webp';
import Text from '@components/Text';
import { useFinishedTxs, useUnfinishedTxs } from '@core/WalletCore/Plugins/ReactInject';
import type { Tx } from '@core/database/models/Tx';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import type React from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { styles as noneStyles } from '../AssetsList/TokensList/ReceiveFunds';
import ActivityItem from './ActivityItem';

const DAY_MILLISECONDS = 1000 * 60 * 60 * 24;

const MONTH_TXT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

class ActivityDate {
  year: number;
  month: number;
  day: number;
  constructor({ year, month, day }: { year: number; month: number; day: number }) {
    this.year = year;
    this.month = month;
    this.day = day;
  }
}
const formatDate = (time: number) => {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return new ActivityDate({ year, month, day });
};

const ActivityList: React.FC<{ onPress?: (v: Tx) => void }> = memo(({ onPress }) => {
  const { colors } = useTheme();
  const finishedTxs = useFinishedTxs();
  const unfinishedTxs = useUnfinishedTxs();
  const { t } = useTranslation();

  const finishedTxsByDay = useMemo(() => {
    let day = 0;
    const txs: (Tx | ActivityDate)[] = [];
    for (let i = 0; i < finishedTxs.length; i++) {
      const tx = finishedTxs[i];
      const time = Math.floor((tx.executedAt || tx.createdAt).valueOf() / DAY_MILLISECONDS) * DAY_MILLISECONDS;
      if (day !== time) {
        day = time;
        txs.push(formatDate(time));
      }
      txs.push(tx);
    }
    return txs;
  }, [finishedTxs]);

  if (!unfinishedTxs?.length && !finishedTxsByDay.length) {
    return (
      <>
        <Image style={noneStyles.noneImg} source={NoneActivity} contentFit="contain" />
        <Text style={[noneStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noActivity')}</Text>
      </>
    );
  }

  return (
    <View style={styles.container}>
      {!!unfinishedTxs?.length && unfinishedTxs.map((tx) => <ActivityItem key={tx.id} tx={tx} onPress={onPress} />)}
      {finishedTxs?.length > 0 &&
        finishedTxsByDay.map((tx, i) =>
          tx instanceof ActivityDate ? (
            <View style={[styles.dateWrapper, i !== 0 && { marginTop: 24 }]} key={`${tx.day}${tx.month}${tx.year}`}>
              <Calendar color={colors.textSecondary} />
              <Text style={[styles.date, { color: colors.textSecondary, borderColor: colors.borderThird }]}>
                {MONTH_TXT[tx.month]} {tx.day},{'  '}
                {tx.year}
              </Text>
            </View>
          ) : (
            <ActivityItem key={tx.id} tx={tx} onPress={onPress} />
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

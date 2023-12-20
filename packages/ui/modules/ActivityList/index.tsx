import { ScrollView, View } from 'react-native';
import ActivityItem from './ActivityItem';
import { useUnfinishedTxs, useFinishedTxs } from '@core/WalletCore/Plugins/ReactInject';
import { memo, useCallback, useMemo } from 'react';
import { Tx } from '@core/database/models/Tx';
import { useTheme, Card, Text } from '@rneui/themed';

const DAY_MILLISECONDS = 1000 * 60 * 60 * 24;

const MONTH_TXT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

const formatDate = (time: number) => {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return {
    year,
    month,
    day,
  };
};

const ActivityList: React.FC<{ onPress?: (v: Tx) => void }> = memo(({ onPress }) => {
  const { theme } = useTheme();
  const finishedTxs = useFinishedTxs();
  const unfinishedTxs = useUnfinishedTxs();

  const { dayMap: finishedTxsByDay, days } = useMemo(() => {
    const dayMap = new Map<number, Tx[]>();
    finishedTxs.forEach((tx) => {
      const time = Math.floor((tx.executedAt || tx.createdAt).valueOf() / DAY_MILLISECONDS) * DAY_MILLISECONDS;
      const txs = dayMap.get(time) || [];
      txs.push(tx);
      dayMap.set(time, txs);
    });
    return {
      days: Array.from(dayMap.keys()),
      dayMap,
    };
  }, [finishedTxs]);

  const handleSelect = useCallback(
    (tx: Tx) => {
      if (onPress) {
        onPress(tx);
      }
    },
    [onPress]
  );

  return (
    <ScrollView>
      <View className="pt-[15px] pb-[25px] px-[25px]">
        {!unfinishedTxs?.length && !finishedTxsByDay.size && <Text>No Data</Text>}
        {!!unfinishedTxs?.length && (
          <View className="mb-[15px]">
            <Card>
              <View className="flex flex-col items-start gap-y-[25px]">
                {unfinishedTxs.map((item) => (
                  <ActivityItem key={item.id} tx={item} onPress={handleSelect} />
                ))}
              </View>
            </Card>
          </View>
        )}
        {!!finishedTxsByDay.size && (
          <Card>
            {days.map((day, index) => {
              const date = formatDate(day);
              return (
                <View key={day}>
                  {index !== 0 && <Card.Divider className="my-[15px]" />}
                  <Text className="mb-[7px]" style={{ color: theme.colors.textSecondary }}>
                    {MONTH_TXT[date.month]} {date.day}, {date.year}
                  </Text>
                  <View className="flex flex-col items-start gap-y-[25px]">
                    {finishedTxsByDay.get(day)!.map((item) => (
                      <ActivityItem key={item.id} tx={item} onPress={handleSelect} />
                    ))}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </ScrollView>
  );
});

export default ActivityList;
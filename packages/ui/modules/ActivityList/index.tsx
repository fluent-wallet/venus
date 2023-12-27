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
    finishedTxs?.forEach((tx) => {
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
      <View className="pt-[15px] pb-[25px] px-[15px] flex gap-y-[15px]">
        {!unfinishedTxs?.length && !finishedTxsByDay.size && <Text>No Data</Text>}
        {!!unfinishedTxs?.length && (
          <View>
            <Card wrapperStyle={{paddingLeft: 0, paddingRight: 0}}>
              {unfinishedTxs.map((item, index) => (
                <View key={item.id}>
                  {index !== 0 && <Card.Divider className="my-[15px] opacity-[0.3]" />}
                  <ActivityItem className='mx-[11px]' tx={item} onPress={handleSelect} />
                </View>
              ))}
            </Card>
          </View>
        )}
        {days.map((day) => {
          const date = formatDate(day);
          return (
            <View key={day}>
              <Card wrapperStyle={{paddingLeft: 0, paddingRight: 0}}>
                <View className='mb-[7px] flex items-start mt-[-11px]'>
                  <View className="rounded-br-[5px] px-[11px] py-[3px]" style={{ backgroundColor: theme.colors.surfaceThird }}>
                    <Text className='text-[14px]' style={{ color: theme.colors.textBrand }}>
                      {MONTH_TXT[date.month]} {date.day}, {date.year}
                    </Text>
                  </View>
                </View>
                {finishedTxsByDay.get(day)!.map((item, index) => (
                  <View key={item.id}>
                    {index !== 0 && <Card.Divider className="my-[15px] opacity-[0.3]" />}
                    <ActivityItem className='mx-[11px]' tx={item} onPress={handleSelect} />
                  </View>
                ))}
              </Card>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
});

export default ActivityList;

import { View } from 'react-native';
import ActivityItem from './ActivityItem';
import { useUnfinishedTxs, useFinishedTxs } from '@core/WalletCore/Plugins/ReactInject';
import { memo, useMemo } from 'react';
import { Tx } from '@core/database/models/Tx';
import { useTheme, Card, Text } from '@rneui/themed';
import NoDataIcon from '@assets/icons/no_data.svg';
import { FlashList } from '@shopify/flash-list';

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

  const finishedTxsByDay = useMemo(() => {
    let day: number;
    const txs: (Tx | number)[] = [];
    finishedTxs?.forEach((tx) => {
      const time = Math.floor((tx.executedAt || tx.createdAt).valueOf() / DAY_MILLISECONDS) * DAY_MILLISECONDS;
      if (day !== time) {
        day = time;
        txs.push(time);
      }
      txs.push(tx);
    });
    return txs;
  }, [finishedTxs]);

  return (
    <View className="pt-[15px] pb-[25px] px-[15px] flex-1">
      {!unfinishedTxs?.length && !finishedTxsByDay.length && (
        <View className="flex flex-col items-center pt-[44px]">
          <NoDataIcon />
          <Text className="mt-[2px] text-[14px] leading-[22px] opacity-40" style={{ color: theme.colors.textBrand }}>
            No Activity
          </Text>
        </View>
      )}
      {!!unfinishedTxs?.length && (
        <View className="py-[11px] rounded-lg mb-[15px]" style={{ backgroundColor: theme.colors.pureBlackAndWight }}>
          {unfinishedTxs.map((item, index) => (
            <View key={item.id}>
              {index !== 0 && <Card.Divider className="my-[15px] opacity-[0.3]" />}
              <ActivityItem className="mx-[11px]" tx={item} onPress={onPress} />
            </View>
          ))}
        </View>
      )}
      {finishedTxs && (
        <FlashList
          estimatedItemSize={20}
          data={finishedTxsByDay}
          renderItem={({ item, index }) => {
            if (typeof item === 'number') {
              const date = formatDate(item);
              return (
                <View
                  className={`pb-[7px] rounded-t-lg flex items-start ${index !== 0 ? 'mt-[15px]' : ''}`}
                  style={{ backgroundColor: theme.colors.pureBlackAndWight }}
                >
                  <View className="rounded-br-[5px] px-[11px] py-[3px]" style={{ backgroundColor: theme.colors.surfaceThird }}>
                    <Text className="text-[14px]" style={{ color: theme.colors.textBrand }}>
                      {MONTH_TXT[date.month]} {date.day}, {date.year}
                    </Text>
                  </View>
                </View>
              );
            }
            const first = typeof finishedTxsByDay[index - 1] === 'number';
            const last = !finishedTxsByDay[index + 1] || typeof finishedTxsByDay[index + 1] === 'number';
            return (
              <View className={`pb-[15px] ${last ? 'rounded-b-lg' : ''}`} style={{ backgroundColor: theme.colors.pureBlackAndWight }}>
                {!first && <Card.Divider className="mb-[15px] opacity-[0.3]" />}
                <ActivityItem className="mx-[11px]" tx={item} onPress={onPress} />
              </View>
            );
          }}
          getItemType={(item) => {
            // To achieve better performance, specify the type based on the item
            return typeof item === 'number' ? 'sectionHeader' : 'row';
          }}
        />
      )}
    </View>
  );
});

export default ActivityList;

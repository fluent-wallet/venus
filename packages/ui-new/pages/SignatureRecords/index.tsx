import NoneSignature from '@assets/images/none-signature.webp';
import Delay from '@components/Delay';
import Text from '@components/Text';
import { SignatureFilterOption } from '@core/services/signing/types';
import { useTheme } from '@react-navigation/native';
import type { SignatureRecordsStackName, StackScreenProps } from '@router/configs';
import { useInfiniteSignatureRecordsOfCurrentAddress } from '@service/signature';
import { ENABLE_SMALL_SIGNATURE_RECORDS_FEATURE } from '@utils/features';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { SignatureItem } from './SignatureItem';
import TypeFilter from './TypeFilter';

const DEFAULT_PAGE_SIZE = ENABLE_SMALL_SIGNATURE_RECORDS_FEATURE.allow ? 10 : 100;

const SignatureRecords: React.FC<StackScreenProps<typeof SignatureRecordsStackName>> = () => {
  const { colors } = useTheme();
  const [maxMessageLength, setMaxMessageLength] = useState(50);
  const [filter, setFilter] = useState(SignatureFilterOption.All);
  const { t } = useTranslation();
  const recordsQuery = useInfiniteSignatureRecordsOfCurrentAddress({
    filter,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = recordsQuery;
  const list = useMemo(() => data?.pages.flat() ?? [], [data]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const containerWidth = e.nativeEvent.layout.width;
    // 10 is for ... and more
    setMaxMessageLength(Math.floor(containerWidth / 5) - 10);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.title}>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600' }}>{t('signature.list.title')}</Text>
        <TypeFilter onChange={setFilter} />
      </View>
      <FlatList
        data={list}
        ListEmptyComponent={
          isLoading ? null : (
            <Delay>
              <View style={styles.empty}>
                <Image source={NoneSignature} style={{ width: 160, height: 160 }} />
                <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '300' }}>{t('signature.list.empty')}</Text>
              </View>
            </Delay>
          )
        }
        keyExtractor={(item) => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => <SignatureItem key={item.id} item={item} maxMessageLength={maxMessageLength} />}
        onLayout={handleContainerLayout}
      />
    </View>
  );
};

export const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingHorizontal: 16,
    flex: 1,
  },
  title: {
    marginBottom: 22,
    marginHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SignatureRecords;

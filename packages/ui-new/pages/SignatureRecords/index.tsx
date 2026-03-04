import NoneSignature from '@assets/images/none-signature.webp';
import Delay from '@components/Delay';
import Text from '@components/Text';
import type { ISignatureRecord } from '@core/services/signing/types';
import { SignatureFilterOption } from '@core/services/signing/types';
import { useTheme } from '@react-navigation/native';
import type { SignatureRecordsStackName, StackScreenProps } from '@router/configs';
import { useCurrentAddress } from '@service/account';
import { fetchSignatureRecords, useSignatureRecordsCountOfCurrentAddress } from '@service/signature';
import { ENABLE_SMALL_SIGNATURE_RECORDS_FEATURE } from '@utils/features';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { SignatureItem } from './SignatureItem';
import TypeFilter from './TypeFilter';

const DEFAULT_PAGE_SIZE = ENABLE_SMALL_SIGNATURE_RECORDS_FEATURE.allow ? 10 : 100;

const SignatureRecords: React.FC<StackScreenProps<typeof SignatureRecordsStackName>> = () => {
  const listRef = useRef<FlatList>(null);
  const { colors } = useTheme();
  const [current, setCurrent] = useState(0);
  const [maxMessageLength, setMaxMessageLength] = useState(50);
  const [filter, setFilter] = useState(SignatureFilterOption.All);
  const { t } = useTranslation();
  const address = useCurrentAddress();
  const addressId = address.data?.id ?? '';
  const totalQuery = useSignatureRecordsCountOfCurrentAddress(filter);
  const total = totalQuery.data ?? 0;
  const initialTotalRef = useRef<number | null>(null);
  const [list, setList] = useState<ISignatureRecord[]>([]);

  // init initialTotalRef while _total has value
  useEffect(() => {
    if (typeof total === 'number' && initialTotalRef.current === null) {
      initialTotalRef.current = total;
    }
  }, [total]);

  // reset initialTotalRef while address or filter changed
  useEffect(() => {
    initialTotalRef.current = null;
    setList([]);
    setCurrent(0);
  }, [addressId, filter]);

  const handleQuery = useCallback(
    async (page = 0) => {
      if (!addressId) {
        return null;
      }
      const data = await fetchSignatureRecords(addressId, {
        current: page,
        pageSize: DEFAULT_PAGE_SIZE,
        offset: total - (initialTotalRef.current ?? total),
        filter,
      });
      if (data.length > 0) {
        setCurrent(page);
        setList((prev) => (page === 0 ? data : [...prev, ...data]));
      }
    },
    [addressId, filter, total],
  );

  const handleLoadMore = useCallback(() => {
    const next = current + 1;
    if (next * DEFAULT_PAGE_SIZE < (initialTotalRef.current ?? total)) {
      return handleQuery(next);
    }
  }, [current, handleQuery, total]);

  useEffect(() => {
    void handleQuery();
    listRef.current?.scrollToOffset({
      offset: 1,
      animated: false,
    });
  }, [handleQuery]);

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
        ref={listRef}
        data={list}
        ListEmptyComponent={
          <Delay>
            <View style={styles.empty}>
              <Image source={NoneSignature} style={{ width: 160, height: 160 }} />
              <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '300' }}>{t('signature.list.empty')}</Text>
            </View>
          </Delay>
        }
        onEndReached={handleLoadMore}
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

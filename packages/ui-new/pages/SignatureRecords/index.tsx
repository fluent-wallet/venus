import NoneSignature from '@assets/images/none-signature.webp';
import Delay from '@components/Delay';
import Text from '@components/Text';
import { useCurrentAddress } from '@core/WalletCore/Plugins/ReactInject';
import { fetchSignatureRecords, useSignatureRecords } from '@core/WalletCore/Plugins/ReactInject/data/useSignature';
import { SignatureFilterOption } from '@core/database/models/Signature/type';
import { useTheme } from '@react-navigation/native';
import type { SignatureRecordsStackName, StackScreenProps } from '@router/configs';
import { ENABLE_SMALL_SIGNATURE_RECORDS_FEATURE } from '@utils/features';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import TypeFilter from './TypeFilter';
import { Image } from 'expo-image';
import { SignatureItem } from './SignatureItem';

const DEFAULT_PAGE_SIZE = ENABLE_SMALL_SIGNATURE_RECORDS_FEATURE.allow ? 10 : 100;

const SignatureRecords: React.FC<StackScreenProps<typeof SignatureRecordsStackName>> = () => {
  const listRef = useRef<FlatList>(null);
  const { colors } = useTheme();
  const [current, setCurrent] = useState(0);
  const [filter, setFilter] = useState(SignatureFilterOption.All);
  const { t } = useTranslation();
  const { records: list, total: _total, setRecords, resetRecords } = useSignatureRecords(filter);
  const address = useCurrentAddress();
  const total = _total ?? 0;
  const initialTotalRef = useRef<number | null>(null);

  // init initialTotalRef while _total has value
  useEffect(() => {
    if (typeof _total === 'number' && initialTotalRef.current === null) {
      initialTotalRef.current = _total;
    }
  }, [_total]);

  // reset initialTotalRef while address or filter changed
  useEffect(() => {
    initialTotalRef.current = null;
  }, [address, filter]);

  const handleQuery = async (page = 0) => {
    if (!address) {
      return null;
    }
    const data = await fetchSignatureRecords(address.id, {
      current: page,
      pageSize: DEFAULT_PAGE_SIZE,
      offset: total - (initialTotalRef.current ?? total),
      filter,
    });
    if (data.length > 0) {
      setCurrent(page);
      setRecords(data);
    }
  };

  const handleLoadMore = () => {
    const next = current + 1;
    if (next * DEFAULT_PAGE_SIZE < (initialTotalRef.current ?? total)) {
      return handleQuery(next);
    }
  };

  useEffect(() => {
    handleQuery();
    listRef.current?.scrollToOffset({
      offset: 1,
      animated: false,
    });
    return resetRecords;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, filter]);

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
        renderItem={({ item }) => <SignatureItem key={item.id} item={item} />}
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

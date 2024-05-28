import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { SignatureRecordsStackName, type StackScreenProps } from '@router/configs';
import { useTranslation } from 'react-i18next';
import { Signature } from '@core/database/models/Signature';
import {
  fetchSignatureRecords,
  resetSignatureRecords,
  setSignatureRecords,
  useSignatureRecords,
  useSignatureRecordsCount,
} from '@core/WalletCore/Plugins/ReactInject/data/useSignature';
import { useCurrentAddress } from '@core/WalletCore/Plugins/ReactInject';

export const SignatureItem: React.FC<{ item: Signature }> = ({ item }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.item, { borderColor: colors.borderThird }]}>
      <Text style={[styles.itemText, { color: colors.textPrimary }]}>{item.message}</Text>
    </View>
  );
};

const DEFAULT_PAGE_SIZE = 10;

const SignatureRecords: React.FC<StackScreenProps<typeof SignatureRecordsStackName>> = () => {
  const { colors } = useTheme();
  const [current, setCurrent] = useState(0);
  // TODO: 监听签名记录变动，新增记录后需要偏移查询
  const [offset, setOffset] = useState(0);
  const { t } = useTranslation();
  const list = useSignatureRecords();
  const total = useSignatureRecordsCount();
  const address = useCurrentAddress();

  const handleQuery = useCallback(
    async (page = 0) => {
      if (!address) {
        return null;
      }
      const data = await fetchSignatureRecords(address.id, {
        current: page,
        pageSize: DEFAULT_PAGE_SIZE,
      });
      if (data.length > 0) {
        setCurrent(page);
        setSignatureRecords(data);
      }
    },
    [address],
  );

  const handleLoadMore = () => {
    const next = current + 1;
    if (next * DEFAULT_PAGE_SIZE < total) {
      return handleQuery(next);
    }
  };

  // fetch data while component mounted
  useEffect(() => {
    handleQuery();
    // reset data when component unmounted
    return () => {
      resetSignatureRecords();
    };
  }, [handleQuery]);
  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('signature.list.title')}</Text>
      <FlatList
        data={list}
        // todo: empty
        ListEmptyComponent={null}
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
  },
  item: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    borderRadius: 6,
    borderWidth: 1,
    height: 90,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '300',
  },
  arrow: {},
});

export default SignatureRecords;

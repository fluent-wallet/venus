import DeleteIcon from '@assets/icons/delete.svg';
import SuccessIcon from '@assets/icons/success.svg';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import Text from '@components/Text';
import { NetworkType } from '@core/types';
import { useTheme } from '@react-navigation/native';
import type { INetwork } from '@service/core';
import { useRemoveEndpoint, useUpdateEndpoint } from '@service/network';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { catchError, interval, retry, startWith, switchMap, throwError } from 'rxjs';

export interface Props {
  rpc: INetwork['endpointsList'][number];
  currentNetwork: INetwork;
}
const RPCListItem = ({ rpc, currentNetwork }: Props) => {
  const { colors } = useTheme();
  const updateEndpoint = useUpdateEndpoint();
  const removeEndpoint = useRemoveEndpoint();
  const [latency, setLatency] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);

  const fetchBlockNumber = useCallback(async () => {
    const endpoint = rpc.endpoint;
    if (currentNetwork.networkType === NetworkType.Conflux) {
      const res = await fetchChain<string>({ url: endpoint, method: 'cfx_epochNumber', params: ['latest_state'] });
      return BigInt(res);
    }

    const res = await fetchChain<string>({ url: endpoint, method: 'eth_blockNumber' });
    return BigInt(res);
  }, [rpc.endpoint, currentNetwork.networkType]);

  const testLatency = useCallback(() => {
    const startTime = Date.now();
    return fetch(rpc.endpoint)
      .then(() => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        setLatency(latency);
      })
      .catch(() => {
        setLatency(-1);
      });
  }, [rpc.endpoint]);

  useEffect(() => {
    const subscription = interval(25000)
      .pipe(
        startWith(0),
        switchMap(() => Promise.all([fetchBlockNumber().then((res) => setBlockNumber(res)), testLatency()])),
        catchError((err: { code: string; message: string }) => {
          return throwError(() => err);
        }),
        retry({ delay: 1000 }),
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [testLatency, fetchBlockNumber]);

  const renderLatency = useCallback(() => {
    const textStyle = [styles.font14, styles.fontWeight400];
    if (latency === null) return <Text style={[textStyle, { color: colors.iconThird }]}>--</Text>;
    if (latency === -1) return <Text style={[textStyle, { color: colors.iconThird }]}>Lost</Text>;

    return <Text style={[textStyle, { color: latency > 500 ? colors.down : colors.up }]}>{latency}ms</Text>;
  }, [latency, colors.down, colors.iconThird, colors.up]);

  const handleDelete = useCallback(async () => {
    await removeEndpoint(currentNetwork.id, rpc.endpoint);
  }, [currentNetwork.id, rpc.endpoint, removeEndpoint]);

  const handleSelect = useCallback(async () => {
    await updateEndpoint(currentNetwork.id, rpc.endpoint);
    testLatency();
  }, [currentNetwork.id, rpc.endpoint, updateEndpoint, testLatency]);

  return (
    <View style={[styles.flex, styles.flexRow]}>
      <View style={[styles.icon, { marginRight: 8 }]}>{currentNetwork?.endpoint === rpc.endpoint && <SuccessIcon color={colors.up} />}</View>

      <Pressable testID="select" style={styles.flex1} onPress={handleSelect}>
        <Text style={[styles.font14, styles.fontWeight400, styles.flex1, { flexShrink: 1, color: colors.textPrimary }]} numberOfLines={1}>
          {rpc.endpoint}
        </Text>

        <View style={[styles.flex, styles.flexRow, { gap: 4 }]}>
          {renderLatency()}
          <Text style={[styles.font14, styles.fontWeight400, { color: colors.textSecondary }]}>{blockNumber ? blockNumber.toString() : '--'}</Text>
        </View>
      </Pressable>
      <View style={[styles.icon, { marginLeft: 8 }]}>
        {rpc.type !== 'inner' && currentNetwork?.endpoint !== rpc.endpoint && <DeleteIcon color={colors.iconPrimary} onPress={handleDelete} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
  },
  flex1: {
    flex: 1,
  },
  font14: {
    fontSize: 14,
  },
  fontWeight300: {
    fontWeight: '300',
  },
  fontWeight400: {
    fontWeight: '400',
  },
  flex: {
    display: 'flex',
  },
  flexRow: {
    flexDirection: 'row',
  },
});
export default RPCListItem;

import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@components/Text';
import type { Network } from '@core/database/models/Network';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@react-navigation/native';
import SuccessIcon from '@assets/icons/success.svg';
import DeleteIcon from '@assets/icons/delete.svg';
import { useCallback, useEffect, useState } from 'react';
import plugins from '@core/WalletCore/Plugins';
export interface Props {
  rpc: Network['endpointsList'][number];
}
const RPCListItem = ({ rpc }: Props) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentNetwork = useCurrentNetwork()!;
  const [latency, setLatency] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);

  const testLatency = useCallback(() => {
    const startTime = new Date().getTime();
    fetch(rpc.endpoint)
      .then(() => {
        const endTime = new Date().getTime();
        const latency = endTime - startTime;
        setLatency(latency);
      })
      .catch(() => {
        setLatency(-1);
      });
  }, []);

  const renderLatency = useCallback(() => {
    const textStyle = [styles.font14, styles.fontWeight400];
    if (latency === null) return <Text style={[textStyle, { color: colors.iconThird }]}>--</Text>;
    if (latency === -1) return <Text style={[textStyle, { color: colors.iconThird }]}>Lost</Text>;

    return <Text style={[textStyle, { color: latency > 500 ? colors.down : colors.up }]}>{latency}ms</Text>;
  }, [latency, colors.down, colors.iconThird, colors.up]);

  const handleDelete = useCallback(async () => {
    console.log(await currentNetwork.removeEndpoints([{ endpoint: rpc.endpoint }]));
  }, []);

  const handleSelect = useCallback(async () => {
    await currentNetwork.updateEndpoint(rpc.endpoint);
  }, []);
  useEffect(() => {
    testLatency();
    plugins.BlockNumberTracker.getNetworkBlockNumber(currentNetwork).then((res) => setBlockNumber(BigInt(res)));
  }, [testLatency, currentNetwork]);
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

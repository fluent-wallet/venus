import DeleteIcon from '@assets/icons/delete.svg';
import SuccessIcon from '@assets/icons/success.svg';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type { INetwork } from '@service/core';
import { useRemoveEndpoint, useUpdateEndpoint } from '@service/network';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export interface Props {
  endpoint: string;
  rpcType: INetwork['endpointsList'][number]['type'];
  networkId: string;
  isSelected: boolean;
  latency: number | null;
  blockNumber: bigint | null;
  onRefreshMetrics: (targetEndpoints?: string[]) => Promise<void>;
}
const RPCListItem = ({ endpoint, rpcType, networkId, isSelected, latency, blockNumber, onRefreshMetrics }: Props) => {
  const { colors } = useTheme();
  const updateEndpoint = useUpdateEndpoint();
  const removeEndpoint = useRemoveEndpoint();

  const latencyColor = latency === null || latency === -1 ? colors.iconThird : latency > 500 ? colors.down : colors.up;
  const latencyText = latency === null ? '--' : latency === -1 ? 'Lost' : `${latency}ms`;

  const handleDelete = async () => {
    await removeEndpoint(networkId, endpoint);
  };

  const handleSelect = async () => {
    await updateEndpoint(networkId, endpoint);
    await onRefreshMetrics([endpoint]);
  };

  return (
    <View style={[styles.flex, styles.flexRow]}>
      <View style={[styles.icon, { marginRight: 8 }]}>{isSelected && <SuccessIcon color={colors.up} />}</View>

      <Pressable testID="select" style={styles.flex1} onPress={handleSelect}>
        <Text style={[styles.font14, styles.fontWeight400, styles.flex1, { flexShrink: 1, color: colors.textPrimary }]} numberOfLines={1}>
          {endpoint}
        </Text>

        <View style={[styles.flex, styles.flexRow, { gap: 4 }]}>
          <Text style={[styles.font14, styles.fontWeight400, { color: latencyColor }]}>{latencyText}</Text>
          <Text style={[styles.font14, styles.fontWeight400, { color: colors.textSecondary }]}>{blockNumber ? blockNumber.toString() : '--'}</Text>
        </View>
      </Pressable>
      <View style={[styles.icon, { marginLeft: 8 }]}>
        {rpcType !== 'inner' && !isSelected && <DeleteIcon color={colors.iconPrimary} onPress={handleDelete} />}
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

export default memo(RPCListItem);

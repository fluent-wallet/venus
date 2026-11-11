import Checkbox from '@components/Checkbox';
import { sheetLayoutStyles } from '@components/Sheet';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type { INetwork } from '@service/core';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { toDataUrl } from '@utils/blockies';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  networks: readonly INetwork[];
  currentNetworkId?: string;
  onSelectNetwork: (networkId: string) => void;
};

const keyExtractor = (network: INetwork) => network.id;

export default function NetworksList({ networks, currentNetworkId, onSelectNetwork }: Props) {
  const renderItem = useCallback<ListRenderItem<INetwork>>(
    ({ item }) => <NetworkItem network={item} isCurrent={item.id === currentNetworkId} onSelectNetwork={onSelectNetwork} />,
    [currentNetworkId, onSelectNetwork],
  );

  return (
    <FlashList
      testID="networksList"
      data={networks}
      extraData={currentNetworkId}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      style={sheetLayoutStyles.scrollable}
      contentContainerStyle={sheetLayoutStyles.scrollContent}
      nestedScrollEnabled
    />
  );
}

function NetworkItem({ network, isCurrent, onSelectNetwork }: Pick<Props, 'onSelectNetwork'> & { network: INetwork; isCurrent: boolean }) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={isCurrent}
      onPress={() => onSelectNetwork(network.id)}
    >
      <Image style={styles.networkImage} source={{ uri: toDataUrl(network.chainId) }} recyclingKey={network.chainId} />
      <View>
        <Text style={[styles.networkName, { color: colors.textPrimary, opacity: network.name ? 1 : 0 }]}>{network.name || 'placeholder'}</Text>
        <Text style={[styles.networkNetId, { color: colors.textSecondary }]}>
          {network.networkType} - {network.chainType}: {network.netId}
        </Text>
      </View>
      {isCurrent && <Checkbox style={styles.checkbox} checked pointerEvents="none" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: 80,
    paddingHorizontal: 16,
  },
  networkImage: {
    width: 32,
    height: 32,
    borderRadius: 32,
    marginRight: 6,
  },
  networkName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  networkNetId: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '300',
  },
  checkbox: {
    marginLeft: 'auto',
  },
});

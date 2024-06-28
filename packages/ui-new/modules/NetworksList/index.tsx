import Checkbox from '@components/Checkbox';
import Text from '@components/Text';
import methods from '@core/WalletCore/Methods';
import { type ChainType, type NetworkType, useCurrentNetwork, useNetworks } from '@core/WalletCore/Plugins/ReactInject';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTheme } from '@react-navigation/native';
import { toDataUrl } from '@utils/blockies';
import { Image } from 'expo-image';
import type React from 'react';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

type ListType = 'selector' | 'manage';

const rowHeight = 80;

interface NetworkProp {
  key: string;
  id: string;
  netId: number;
  chainId: string;
  name: string;
  networkType: NetworkType;
  chainType: ChainType;
}

const Network: React.FC<
  NetworkProp & { colors: ReturnType<typeof useTheme>['colors']; isCurrent: boolean; type: ListType; mode: 'dark' | 'light'; onSelect?: () => void }
> = ({ id, netId, chainId, name, networkType, chainType, colors, isCurrent, type, mode, onSelect }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={type === 'selector' && isCurrent}
      onPress={() => {
        if (type === 'selector') {
          methods.switchToNetwork(id);
          onSelect?.();
        } else {
        }
      }}
    >
      <Image style={styles.networkImage} source={{ uri: toDataUrl(chainId) }} />
      <View>
        <Text style={[styles.networkName, { color: colors.textPrimary, opacity: name ? 1 : 0 }]}>{name || 'placeholder'}</Text>
        <Text style={[styles.networkNetId, { color: colors.textSecondary }]}>
          {networkType} - {chainType}: {netId}
        </Text>
      </View>
      {isCurrent && <Checkbox style={styles.checkbox} checked pointerEvents="none" />}
    </Pressable>
  );
};

const NetworksList: React.FC<{ type: ListType; onSelect?: () => void }> = ({ type, onSelect }) => {
  const networks = useNetworks();
  const currentNetwork = useCurrentNetwork();

  const { colors, mode } = useTheme();
  const ListComponent = useMemo(() => (type === 'selector' ? BottomSheetFlatList : FlatList), [type]);

  if (!networks?.length) return null;
  return (
    <ListComponent
      data={networks}
      renderItem={({ item }) => (
        <Network
          id={item.id}
          key={item.id}
          name={item.name}
          netId={item.netId}
          chainId={item.chainId}
          networkType={item.networkType}
          chainType={item.chainType}
          colors={colors}
          type={type}
          isCurrent={currentNetwork?.id === item.id}
          mode={mode}
          onSelect={onSelect}
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: rowHeight,
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

export default NetworksList;

import { NFTCollectionItem } from '@modules/AssetsList/NFTsList/NFTCollectionItem';
import { useOpenNftCollection } from '@modules/AssetsList/NFTsList/openState';
import { useShouldShowNotBackup } from '@pages/Home/NotBackup';
import { useCurrentAddress } from '@service/account';
import { useNftCollectionsOfAddress } from '@service/nft';
import type React from 'react';
import { useMemo } from 'react';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { TabsType } from './types';

export const StickyNFT: React.FC<{ type: TabsType; sharedScrollY: SharedValue<number> }> = ({ type, sharedScrollY }) => {
  const shouldShowNotBackup = useShouldShowNotBackup();
  const [open, setOpen] = useOpenNftCollection();
  const { data: currentAddress } = useCurrentAddress();
  const addressId = currentAddress?.id ?? '';
  const { data: collections = [] } = useNftCollectionsOfAddress(addressId, { enabled: Boolean(open) });

  const openCollection = useMemo(() => {
    if (!open?.contractAddress) return null;
    const key = open.contractAddress.toLowerCase();
    return collections.find((c) => c.contractAddress.toLowerCase() === key) ?? null;
  }, [collections, open?.contractAddress]);

  const startY = useMemo(() => (type === 'Home' ? (shouldShowNotBackup ? 324 : 200) : 1), [type, shouldShowNotBackup]);
  const showY = startY + (open?.index ?? 0) * 70;

  const animatedStyle = useAnimatedStyle(() => {
    const value = sharedScrollY.get();
    const opacity = interpolate(value, [showY - 10, showY], [0, 1], 'clamp');

    return {
      opacity,
      // Keep the same behavior as before: only allow interactions when sticky is fully shown.
      pointerEvents: value < showY ? 'none' : 'auto',
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    };
  });

  if (!open || !openCollection) return null;

  return (
    <Animated.View style={[animatedStyle]}>
      <NFTCollectionItem collection={openCollection} isOpen background={type === 'Home' ? 'home' : 'sheet'} onPress={() => setOpen(null)} />
    </Animated.View>
  );
};

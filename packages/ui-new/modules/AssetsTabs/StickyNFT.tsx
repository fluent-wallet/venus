import { getNFTDetailTracker } from '@WalletCoreExtends/index';
import { useCurrentOpenNFTDetail } from '@core/WalletCore/Plugins/ReactInject';
import { NFTItem } from '@modules/AssetsList/NFTsList/NFTItem';
import { useShouldShowNotBackup } from '@pages/Home/NotBackup';
/* eslint-disable react-hooks/exhaustive-deps */
import type React from 'react';
import { useMemo } from 'react';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { TabsType } from './types';

export const StickyNFT: React.FC<{ type: TabsType; sharedScrollY: SharedValue<number> }> = ({ type, sharedScrollY }) => {
  const shouldShowNotBackup = useShouldShowNotBackup();
  const currentOpenNFT = useCurrentOpenNFTDetail();

  const startY = useMemo(() => (type === 'Home' ? (shouldShowNotBackup ? 324 : 200) : 1), [type, shouldShowNotBackup]);
  const showY = startY + (currentOpenNFT?.index ?? 0) * 70;

  const animatedStyle = useAnimatedStyle(() => {
    const value = sharedScrollY.get();

    const opacity = interpolate(value, [showY - 10, showY], [0, 1], 'clamp');

    return {
      opacity,
      pointerEvents: value < showY ? 'none' : 'auto',
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    };
  });

  if (!currentOpenNFT || currentOpenNFT?.index === undefined) return null;

  return (
    <Animated.View style={[animatedStyle]}>
      <NFTItem data={currentOpenNFT.nft} onPress={() => getNFTDetailTracker().setCurrentOpenNFT(undefined)} tabsType={type} isCurrent />
    </Animated.View>
  );
};

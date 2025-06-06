import { StickyNFTItem } from '@modules/AssetsList/NFTsList/NFTItem';
import { useShouldShowNotBackup } from '@pages/Home/NotBackup';
/* eslint-disable react-hooks/exhaustive-deps */
import type React from 'react';
import { useMemo } from 'react';
import type { TabsType } from './types';
import { mapOfUseTabPageViewScrollY } from './atoms';

export const StickyNFT: React.FC<{ type: TabsType }> = ({ type }) => {
  const shouldShowNotBackup = useShouldShowNotBackup();
  const scrollY = mapOfUseTabPageViewScrollY[type]();
  const startY = useMemo(() => (type === 'Home' ? (shouldShowNotBackup ? 324 : 200) : 1), [type, shouldShowNotBackup]);
  return <StickyNFTItem scrollY={scrollY} startY={startY} tabsType={type} />;
};

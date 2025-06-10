import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import type { TabsArrayType, TabsType, TabType } from './types';
import { useCallback, useMemo, useState } from 'react';
import { Networks } from '@core/utils/consts';
import { useSharedValue } from 'react-native-reanimated';
export const useTabs = (type: TabsType, onlyToken?: boolean): TabsArrayType => {
  const currentNetwork = useCurrentNetwork();

  return useMemo(() => {
    const tabs: TabsArrayType = ['Tokens'];

    const shouldShowNFTs =
      !onlyToken &&
      (!currentNetwork || currentNetwork.chainId === Networks['Conflux eSpace'].chainId || currentNetwork.chainId === Networks['eSpace Testnet'].chainId);

    if (shouldShowNFTs) {
      tabs.push('NFTs');
    }

    if (type === 'Home') {
      tabs.push('Activity');
    }
    return tabs;
  }, [currentNetwork, type, onlyToken]);
};

export const useTabsController = (initialTab = 'Tokens' as TabType) => {
  const [currentTab, setCurrentTab] = useState<TabType>(initialTab);
  const sharedScrollY = useSharedValue(0);
  const handleScroll = useCallback(
    (y: number) => {
      sharedScrollY.set(y);
    },
    [sharedScrollY],
  );

  const resetScrollY = useCallback(() => {
    sharedScrollY.set(0);
  }, [sharedScrollY]);

  return {
    currentTab,
    setCurrentTab,
    sharedScrollY,
    handleScroll,
    resetScrollY,
  };
};

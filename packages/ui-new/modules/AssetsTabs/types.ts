import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import type { Tx } from '@core/database/models/Tx';
import type React from 'react';
import type PagerView from 'react-native-pager-view';

export type TabType = 'Tokens' | 'NFTs' | 'Activity';

export type TabsType = 'Home' | 'SelectAsset';
export type TabsArrayType = Array<TabType>;

export interface BaseProps {
  type: TabsType;
  currentTab: TabType;
  pageViewRef: React.RefObject<PagerView>;
  setCurrentTab: (tab: TabType) => void;
  onlyToken?: boolean;
}

export type Props =
  | (BaseProps & {
      selectType: 'Send' | 'Receive';
      onPressItem?: (v: AssetInfo) => void;
    })
  | (BaseProps & {
      selectType: 'Home';
      onPressItem?: (v: AssetInfo | Tx) => void;
    });

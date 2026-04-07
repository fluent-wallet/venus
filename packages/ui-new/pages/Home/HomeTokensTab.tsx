import NoneToken from '@assets/images/none-token.webp';
import Text from '@components/Text';
import { Networks, NetworkType } from '@core/utils/consts';
import { usePriceVisibleValue } from '@hooks/usePriceVisible';
import { areDisplayTokensEmpty, getTokenItemKey, getVisibleTokenAssets, shouldShowTokensSkeleton } from '@modules/AssetsList/TokensList/helpers';
import ReceiveFunds, { styles as emptyStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import TokenSkeleton from '@modules/AssetsList/TokensList/Skeleton';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { useCurrentNetwork } from '@service/network';
import type { AssetInfo } from '@utils/assetInfo';
import { toAssetInfo } from '@utils/toAssetInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { type RefObject, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { type HomeFlashListRef, HomeFlashTabList } from './HomeTabList';

export type HomeTokensRow =
  | { key: 'tokens-skeletons'; kind: 'tokens-skeletons' }
  | { key: 'tokens-empty'; kind: 'tokens-empty'; showReceiveFunds: boolean }
  | { key: string; kind: 'token'; asset: AssetInfo };

function isAssetInfo(asset: AssetInfo | null): asset is AssetInfo {
  return asset !== null;
}

const TokensEmptyState: React.FC<{ showReceiveFunds: boolean }> = ({ showReceiveFunds }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (showReceiveFunds) {
    return <ReceiveFunds />;
  }

  return (
    <>
      <Image style={emptyStyles.noneImg} source={NoneToken} contentFit="contain" />
      <Text style={[emptyStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noToken')}</Text>
    </>
  );
};

export const HomeTokensTab: React.FC<{
  flatListRef: RefObject<HomeFlashListRef<HomeTokensRow> | null>;
  topInset: number;
  onLayoutHeightChange?: (height: number) => void;
  onContentHeightChange?: (height: number) => void;
  scrollOffset: SharedValue<number>;
  sharedScrollY: SharedValue<number>;
  isActive: boolean;
  scrollGesture: GestureType;
}> = ({ flatListRef, topInset, onLayoutHeightChange, onContentHeightChange, scrollOffset, sharedScrollY, isActive, scrollGesture }) => {
  const currentAddressQuery = useCurrentAddress();
  const assetsQuery = useAssetsOfCurrentAddress();
  const currentNetworkQuery = useCurrentNetwork();
  const priceVisible = usePriceVisibleValue();

  const assets = assetsQuery.data ?? [];
  const currentAddressId = currentAddressQuery.data?.id ?? '';
  const currentNetwork = currentNetworkQuery.data;
  const visibleAssets = useMemo(() => getVisibleTokenAssets(assets, { showHomeAssetsOnly: true }), [assets]);
  const tokens = useMemo(() => visibleAssets.map(toAssetInfo).filter(isAssetInfo), [visibleAssets]);
  const isTokensEmpty = useMemo(() => areDisplayTokensEmpty(tokens), [tokens]);
  const shouldShowSkeleton = useMemo(
    () =>
      shouldShowTokensSkeleton({
        addressId: currentAddressId,
        assetsStatus: assetsQuery.status,
        currentAddressStatus: currentAddressQuery.status,
        tokenCount: tokens.length,
      }),
    [assetsQuery.status, currentAddressId, currentAddressQuery.status, tokens.length],
  );
  const showReceiveFunds = Boolean(
    currentNetwork?.networkType === NetworkType.Ethereum &&
      (currentNetwork.chainId === Networks['Conflux eSpace'].chainId || currentNetwork.chainId === Networks['eSpace Testnet'].chainId),
  );

  const contentRows = useMemo<HomeTokensRow[]>(() => {
    if (shouldShowSkeleton) {
      return [{ key: 'tokens-skeletons', kind: 'tokens-skeletons' }];
    }

    if (isTokensEmpty) {
      return [{ key: 'tokens-empty', kind: 'tokens-empty', showReceiveFunds }];
    }

    return tokens.map((token, index) => ({
      key: getTokenItemKey(token, index),
      kind: 'token',
      asset: token,
    }));
  }, [isTokensEmpty, shouldShowSkeleton, showReceiveFunds, tokens]);

  const renderContentItem = useCallback(
    (item: HomeTokensRow) => {
      switch (item.kind) {
        case 'tokens-skeletons':
          return <TokenSkeleton />;
        case 'tokens-empty':
          return <TokensEmptyState showReceiveFunds={item.showReceiveFunds} />;
        case 'token':
          return <TokenItem data={item.asset} hidePrice={!priceVisible ? 'encryption' : false} hideBalance={!priceVisible ? 'encryption' : false} />;
        default:
          return null;
      }
    },
    [priceVisible],
  );

  return (
    <HomeFlashTabList
      flatListRef={flatListRef}
      contentRows={contentRows}
      renderContentItem={renderContentItem}
      topInset={topInset}
      onLayoutHeightChange={onLayoutHeightChange}
      onContentHeightChange={onContentHeightChange}
      scrollOffset={scrollOffset}
      sharedScrollY={sharedScrollY}
      isActive={isActive}
      scrollGesture={scrollGesture}
      getItemType={(item) => item.kind}
    />
  );
};

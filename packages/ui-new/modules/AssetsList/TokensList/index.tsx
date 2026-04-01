import NoneToken from '@assets/images/none-token.webp';
import Text from '@components/Text';
import { ASSET_SOURCE, ASSET_TYPE } from '@core/types';
import { usePriceVisibleValue } from '@hooks/usePriceVisible';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import type { AssetInfo } from '@utils/assetInfo';
import { toAssetInfo } from '@utils/toAssetInfo';
import Decimal from 'decimal.js';
import { Image } from 'expo-image';
import type React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReceiveFunds, { styles } from './ReceiveFunds';
import Skeleton from './Skeleton';
import TokenItem from './TokenItem';

interface Props {
  onPressItem?: (v: AssetInfo) => void;
  showReceiveFunds?: boolean;
  selectType: 'Home' | 'Send' | 'Receive';
}

function shouldShowAssetOnHome(asset: { type: string; source: string | null; balance?: string | null }): boolean {
  if (asset.type === ASSET_TYPE.Native || asset.source === ASSET_SOURCE.Custom) {
    return true;
  }

  try {
    return new Decimal(asset.balance ?? '0').greaterThan(0);
  } catch {
    return false;
  }
}

function hasPositiveTokenBalance(token: AssetInfo): boolean {
  try {
    return BigInt(token.balance || '0') > 0n;
  } catch {
    return false;
  }
}

function isAssetInfo(token: AssetInfo | null): token is AssetInfo {
  return token !== null;
}

const TokensList: React.FC<Props> = ({ onPressItem, selectType, showReceiveFunds = false }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const currentAddressQuery = useCurrentAddress();
  const assetsQuery = useAssetsOfCurrentAddress();
  const assets = assetsQuery.data ?? [];
  const visibleAssets = useMemo(
    () =>
      assets
        .filter((asset) => asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20)
        .filter((asset) => (selectType === 'Home' ? shouldShowAssetOnHome(asset) : true)),
    [assets, selectType],
  );
  const tokens = useMemo(() => visibleAssets.map(toAssetInfo).filter(isAssetInfo), [visibleAssets]);

  const isTokensEmpty = useMemo(() => {
    if (tokens.length === 0) return true;
    return tokens.every((token) => !hasPositiveTokenBalance(token));
  }, [tokens]);
  const priceVisible = usePriceVisibleValue();
  const shouldShowSkeleton =
    tokens.length === 0 && (currentAddressQuery.status === 'pending' || (Boolean(currentAddressQuery.data?.id) && assetsQuery.status === 'pending'));

  if (shouldShowSkeleton) {
    return <Skeleton />;
  }

  if (selectType !== 'Receive' && isTokensEmpty) {
    if (showReceiveFunds) {
      return <ReceiveFunds />;
    }
    return (
      <>
        <Image style={styles.noneImg} source={NoneToken} contentFit="contain" />
        <Text style={[styles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noToken')}</Text>
      </>
    );
  }

  return tokens.map((token, index) => (
    <TokenItem
      key={token.contractAddress || index}
      hidePrice={selectType === 'Receive' ? true : selectType === 'Home' ? (!priceVisible ? 'encryption' : false) : false}
      hideBalance={selectType === 'Receive' ? true : selectType === 'Home' ? (!priceVisible ? 'encryption' : false) : false}
      showAddress={selectType === 'Receive'}
      data={token}
      onPress={onPressItem}
    />
  ));
};

export default TokensList;

import NoneToken from '@assets/images/none-token.webp';
import Text from '@components/Text';
import { usePriceVisibleValue } from '@hooks/usePriceVisible';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import type { AssetInfo } from '@utils/assetInfo';
import { toAssetInfo } from '@utils/toAssetInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { areDisplayTokensEmpty, getVisibleTokenAssets, shouldShowTokensSkeleton } from './helpers';
import ReceiveFunds, { styles } from './ReceiveFunds';
import Skeleton from './Skeleton';
import TokenItem from './TokenItem';

interface Props {
  onPressItem?: (v: AssetInfo) => void;
  showReceiveFunds?: boolean;
  selectType: 'Home' | 'Send' | 'Receive';
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
  const currentAddressId = currentAddressQuery.data?.id ?? '';
  const visibleAssets = useMemo(() => getVisibleTokenAssets(assets, { showHomeAssetsOnly: selectType === 'Home' }), [assets, selectType]);
  const tokens = useMemo(() => visibleAssets.map(toAssetInfo).filter(isAssetInfo), [visibleAssets]);
  const isTokensEmpty = useMemo(() => areDisplayTokensEmpty(tokens), [tokens]);
  const priceVisible = usePriceVisibleValue();
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

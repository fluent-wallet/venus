import NoneToken from '@assets/images/none-token.webp';
import Text from '@components/Text';
import { ASSET_TYPE } from '@core/types';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { usePriceVisibleValue } from '@hooks/usePriceVisible';
import { useTheme } from '@react-navigation/native';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { toLegacyAssetInfo } from '@utils/toLegacyAssetInfo';
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

const TokensList: React.FC<Props> = ({ onPressItem, selectType, showReceiveFunds = false }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const assetsQuery = useAssetsOfCurrentAddress();
  const tokens = useMemo(() => {
    const list = (assetsQuery.data ?? []).filter((a) => a.type === ASSET_TYPE.Native || a.type === ASSET_TYPE.ERC20).map(toLegacyAssetInfo);

    const native = list.filter((t) => t.type === ASSET_TYPE.Native);
    const rest = list
      .filter((t) => t.type !== ASSET_TYPE.Native)
      .slice()
      .sort((a, b) => {
        const aKey = String(a.name || a.symbol || a.contractAddress || '').toLowerCase();
        const bKey = String(b.name || b.symbol || b.contractAddress || '').toLowerCase();
        return aKey.localeCompare(bKey);
      });
    return [...native, ...rest];
  }, [assetsQuery.data]);

  const isTokensEmpty = useMemo(() => {
    if (tokens.length === 0) return true;
    return tokens.every((token) => {
      try {
        return BigInt(token.balance || '0') <= 0n;
      } catch {
        return true;
      }
    });
  }, [tokens]);
  const priceVisible = usePriceVisibleValue();

  if (assetsQuery.isLoading && tokens.length === 0) {
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

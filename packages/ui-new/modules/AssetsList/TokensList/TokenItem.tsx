import Text from '@components/Text';
import { AssetType } from '@core/database/models/Asset';
import { shortenAddress } from '@core/utils/address';
import { numberWithCommas } from '@core/utils/balance';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import useFormatBalance from '@hooks/useFormatBalance';
import { useTheme } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AssetTypeLabel from '../AssetTypeLabel';
import TokenIcon from './TokenIcon';

const TokenItem: React.FC<{
  data: AssetInfo;
  onPress?: (v: AssetInfo) => void;
  hidePrice?: boolean | 'encryption';
  hideBalance?: boolean | 'encryption';
  showAddress?: boolean;
  showTypeLabel?: boolean;
}> = ({ onPress, data, hidePrice = false, hideBalance = false, showTypeLabel = false, showAddress = false }) => {
  const { colors } = useTheme();
  const balance = useFormatBalance(data.balance, data.decimals);
  const price = useMemo(() => (data.priceValue ? `$${numberWithCommas(data.priceValue)}` : '--'), [data.priceValue]);

  const handlePress = useCallback(() => onPress?.(data), [onPress, data]);
  return (
    <Pressable
      testID="tokenItem"
      style={({ pressed }) => [styles.container, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      disabled={!onPress}
      onPress={handlePress}
    >
      <TokenIcon style={styles.tokenIcon} source={data.icon} />
      <View style={styles.textArea}>
        <View style={styles.textTitle}>
          <Text style={[styles.tokenName, { color: colors.textPrimary }]} numberOfLines={1}>
            {data.name}
          </Text>
          {showTypeLabel && <AssetTypeLabel assetType={data.type} />}
          {(hidePrice === false || hidePrice === 'encryption') && (
            <Text style={[styles.tokenName, { marginLeft: 'auto', textAlign: 'right', color: colors.textPrimary }]} numberOfLines={1}>
              {hidePrice === 'encryption' ? '***' : price}
            </Text>
          )}
          {showAddress && data.type !== AssetType.Native && data?.contractAddress && (
            <Text style={[styles.tokenAddress, { marginLeft: 'auto', textAlign: 'right', color: colors.textSecondary }]} numberOfLines={1}>
              {shortenAddress(data.contractAddress)}
            </Text>
          )}
        </View>

        <Text style={[styles.tokenBalance, { color: colors.textSecondary }]} numberOfLines={1}>
          {hideBalance === true ? data.symbol : `${hideBalance === 'encryption' ? '***' : balance} ${data.symbol}`}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 70,
  },
  tokenIcon: {
    width: 40,
    height: 40,
  },
  textArea: {
    position: 'relative',
    flex: 1,
    marginLeft: 8,
  },
  textTitle: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    maxWidth: 160,
  },
  tokenBalance: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
    maxWidth: 136,
    marginTop: 6,
  },
  tokenAddress: {
    fontSize: 12,
    fontWeight: '300',
  },
});

export default TokenItem;

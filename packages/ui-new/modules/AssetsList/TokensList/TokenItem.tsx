import { useCallback, useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { numberWithCommas } from '@core/utils/balance';
import useFormatBalance from '@hooks/useFormatBalance';
import Text from '@components/Text';
import TokenIcon from './TokenIcon';
import AssetTypeLabel from '../AssetTypeLabel';

const TokenItem: React.FC<{
  data: AssetInfo;
  onPress?: (v: AssetInfo) => void;
  hidePrice?: boolean;
  hideBalance?: boolean;
  showTypeLabel?: boolean;
}> = ({ onPress, data, hidePrice = false, hideBalance = false, showTypeLabel = false }) => {
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
      <TokenIcon style={styles.tokenIcon} source={data.icon}/>
      <View style={styles.textArea}>
        <View style={styles.textTitle}>
          <Text style={[styles.tokenName, { color: colors.textPrimary }]} numberOfLines={1}>
            {data.name}
          </Text>
          {showTypeLabel && <AssetTypeLabel assetType={data.type} />}
          {!hidePrice && (
            <Text style={[styles.tokenName, { marginLeft: 'auto', textAlign: 'right', color: colors.textPrimary }]} numberOfLines={1}>
              {price}
            </Text>
          )}
        </View>

        {!hideBalance && (
          <Text style={[styles.tokenBalance, { color: colors.textSecondary }]} numberOfLines={1}>
            {balance} {data.symbol}
          </Text>
        )}
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
});

export default TokenItem;

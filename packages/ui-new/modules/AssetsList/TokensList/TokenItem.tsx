import { useCallback, useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Decimal from 'decimal.js';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { balanceFormat, convertBalanceToDecimal, numberWithCommas } from '@core/utils/balance';
import Text from '@components/Text';
import TokenIcon from './TokenIcon';

const TokenItem: React.FC<{
  data: AssetInfo;
  onPress?: (v: AssetInfo) => void;
  hidePrice?: boolean;
  hideBalance?: boolean;
}> = ({ onPress, data, hidePrice = false, hideBalance = false }) => {
  const { colors } = useTheme();

  const balance = useMemo(() => {
    const n = new Decimal(convertBalanceToDecimal(data.balance, data.decimals));
    if (n.lessThan(new Decimal(10).pow(-4))) {
      return '<0.0001';
    }
    return numberWithCommas(balanceFormat(data.balance, { decimals: data.decimals }));
  }, [data.balance, data.decimals]);

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
          {!hidePrice && (
            <Text style={[styles.tokenName, { textAlign: 'right', color: colors.textPrimary }]} numberOfLines={1}>
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
    justifyContent: 'space-between',
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
    lineHeight: 15,
    maxWidth: 136,
    marginTop: 5,
  },
});

export default TokenItem;

import Text from '@components/Text';
import { AccountItemView } from '@modules/AccountsList';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

interface Props {
  amount?: string;
  symbol?: string;
  price?: string | null;
  icon?: string | null;
  recipientAddress: string;
}

const SendAsset: React.FC<Props> = ({ amount, symbol, icon, price, recipientAddress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <>
      {(amount || symbol) && (
        <>
          <Text style={[styles.text, styles.ph16, { color: colors.textSecondary }]}>{t('common.amount')}</Text>
          <View style={[styles.balanceWrapper, styles.ph16]}>
            <Text style={[styles.balance, { color: colors.textPrimary }]} numberOfLines={1}>
              {amount}
              {symbol ? ` ${symbol}` : ''}
            </Text>
            {icon && <TokenIcon style={styles.assetIcon} source={icon} />}
          </View>
        </>
      )}

      {price && <Text style={[styles.text, styles.price, { color: colors.textSecondary }]}>≈${price}</Text>}

      <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>{t('common.to')}</Text>
      <AccountItemView nickname={''} addressValue={recipientAddress} colors={colors} />
    </>
  );
};

const styles = StyleSheet.create({
  ph16: {
    paddingHorizontal: 16,
  },
  to: {
    marginTop: 24,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  balanceWrapper: {
    marginTop: 14,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 24,
  },
  balance: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  price: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  assetIcon: {
    width: 24,
    height: 24,
    borderRadius: 48,
  },
});

export default SendAsset;

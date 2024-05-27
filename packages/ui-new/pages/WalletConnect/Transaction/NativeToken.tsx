import { Image } from 'expo-image';
import { StyleSheet,  View } from 'react-native';
import Copy from '@assets/icons/copy.svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@react-navigation/native';
import Icon from '@components/Icon';
import { toDataUrl } from '@utils/blockies';
import { shortenAddress } from '@core/utils/address';
import { useCallback, useMemo } from 'react';

import Clipboard from '@react-native-clipboard/clipboard';
import { showMessage } from 'react-native-flash-message';
import { useCurrentNetworkNativeAsset } from '@core/WalletCore/Plugins/ReactInject';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import Text from '@components/Text'

interface IProps {
  amount: string;
  receiverAddress?: string;
}

function SendNativeToken({ amount, receiverAddress }: IProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentNativeToken = useCurrentNetworkNativeAsset();

  const price = useMemo(() => calculateTokenPrice({ price: currentNativeToken?.priceInUSDT, amount }), [currentNativeToken?.priceInUSDT, amount]);

  const handleCoy = useCallback(
    (value: string) => {
      Clipboard.setString(value);
      showMessage({
        message: t('common.copied'),
        type: 'success',
        duration: 1500,
        width: 160,
      });
    },
    [t],
  );
  return (
    <View>
      <Text style={[styles.send, { color: colors.textPrimary }]}>{t('common.send')}</Text>
      <Text style={[styles.secondary]}>{t('common.amount')}</Text>

      <View style={[styles.flexWithRow, { marginTop: 8 }]}>
        <Text style={[styles.amount, { color: colors.textPrimary }]}>
          {amount} {currentNativeToken?.symbol}
        </Text>
        {currentNativeToken?.icon && <Icon source={currentNativeToken.icon} width={24} height={24} />}
      </View>
      <Text style={[styles.secondary, styles.secondary, { color: colors.textSecondary }]}>≈${price}</Text>

      <Text style={[styles.to, { color: colors.textSecondary }]}>{t('common.to')}</Text>

      {receiverAddress && (
        <View style={[styles.flexWithRow, styles.addressInfo]}>
          <Image source={{ uri: toDataUrl(receiverAddress) }} style={styles.avatar} />
          <View style={styles.flexWithRow}>
            <Text style={[styles.smallText, { color: colors.textSecondary }]}>{shortenAddress(receiverAddress)}</Text>
            <Copy width={12} height={12} color={colors.textSecondary} testID="copy" onPress={() => handleCoy(receiverAddress)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  send: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
  },
  secondary: {
    fontSize: 14,
    fontWeight: '300',
  },
  flexWithRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  to: {
    marginTop: 24,
    marginBottom: 16,
  },
  addressInfo: {
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  smallText: {
    fontSize: 12,
    fontWeight: '300',
  },
});

export default SendNativeToken;

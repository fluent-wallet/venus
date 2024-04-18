import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { showMessage } from 'react-native-flash-message';
import { useCurrentAddressValue, useAssetsTotalPriceValue } from '@core/WalletCore/Plugins/ReactInject';
import { zeroAddress, shortenAddress } from '@core/utils/address';
import { numberWithCommas } from '@core/utils/balance'
import { usePriceVisible } from '@hooks/usePriceVisible';
import Text from '@components/Text';
import Skeleton from '@components/Skeleton';
import Copy from '@assets/icons/copy.svg';
import EyeOpen from '@assets/icons/eye-open.svg';
import EyeClose from '@assets/icons/eye-close.svg';
import Asterisk from '@assets/icons/asterisk.svg';
import { useTranslation } from 'react-i18next';

export const CurrentAddress: React.FC = () => {
  const { colors } = useTheme();
  const currentAddressValue = useCurrentAddressValue();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => {
        Clipboard.setString(currentAddressValue ?? '');
        showMessage({
          message: t('common.copied'),
          type: 'success',
          duration: 1500,
          width: 160,
        });
      }}
      disabled={!currentAddressValue}
      style={({ pressed }) => [styles.addressContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
    >
      <Text style={{ color: colors.textSecondary, opacity: currentAddressValue ? 1 : 0 }}>{shortenAddress(currentAddressValue || zeroAddress)}</Text>
      <Copy color={colors.textSecondary} />
    </Pressable>
  );
};

export const TotalPrice: React.FC = () => {
  const { colors } = useTheme();
  const totalPriceValue = useAssetsTotalPriceValue();
  const [priceVisible, setPriceVisible] = usePriceVisible();

  const Asterisks = useCallback(
    () => (
      <View style={[styles.asterisksContainer, { opacity: priceVisible ? 0 : 1 }]} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, index) => (
          <Asterisk key={index} color={colors.textPrimary} width={12} height={12} />
        ))}
        <EyeOpen color={colors.textPrimary} width={24} height={24} style={styles.eye} />
      </View>
    ),
    [colors.textPrimary, priceVisible],
  );

  if (totalPriceValue === null) {
    return <Skeleton width={140} height={45} startX={16} />;
  }

  return (
    <Pressable
      onPress={() => setPriceVisible(!priceVisible)}
      disabled={priceVisible === undefined}
      style={({ pressed }) => [styles.totalPriceContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
    >
      <Asterisks />
      <Text style={[styles.totalPriceText, { color: colors.textPrimary, opacity: priceVisible ? 1 : 0 }]} numberOfLines={1}>
        ${numberWithCommas(totalPriceValue)}
      </Text>
      <EyeClose color={colors.textPrimary} width={24} height={24} style={[styles.eye, { opacity: priceVisible ? 1 : 0 }]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  addressContainer: {
    marginBottom: 4,
    alignSelf: 'flex-start',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    minWidth: 140,
    gap: 6,
  },
  totalPriceContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    minWidth: 140,
    height: 45,
  },
  totalPriceText: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 45,
  },
  asterisksContainer: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  eye: {
    marginLeft: 6,
  },
});

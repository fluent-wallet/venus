import Asterisk from '@assets/icons/asterisk.svg';
import Copy from '@assets/icons/copy.svg';
import EyeClose from '@assets/icons/eye-close.svg';
import EyeOpen from '@assets/icons/eye-open.svg';
import Skeleton from '@components/Skeleton';
import Text from '@components/Text';
import { shortenAddress, zeroAddress } from '@core/utils/address';
import { numberWithCommas, truncate } from '@core/utils/balance';
import { usePriceVisible } from '@hooks/usePriceVisible';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import { useAssetsSummaryOfCurrentAddress } from '@service/asset';
import type React from 'react';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCopyTextWithToast } from './useCopyTextWithToast';

const ASTERISK_PLACEHOLDERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export const CurrentAddress: React.FC = () => {
  const { colors } = useTheme();
  const { data: currentAddress } = useCurrentAddress();
  const currentAddressValue = currentAddress?.value ?? null;
  const copyText = useCopyTextWithToast();

  return (
    <Pressable
      onPress={() => {
        copyText(currentAddressValue);
      }}
      disabled={!currentAddressValue}
      style={({ pressed }) => [styles.addressContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      testID="currentAddress"
    >
      <Text style={{ color: colors.textSecondary, opacity: currentAddressValue ? 1 : 0 }}>{shortenAddress(currentAddressValue || zeroAddress)}</Text>
      <Copy color={colors.textSecondary} />
    </Pressable>
  );
};

export const TotalPrice: React.FC = () => {
  const { colors } = useTheme();
  const { data: summary } = useAssetsSummaryOfCurrentAddress();
  const totalPriceValue = summary?.totalValue ?? null;
  const [priceVisible, setPriceVisible] = usePriceVisible();

  const Asterisks = useCallback(
    () => (
      <View style={[styles.asterisksContainer, { opacity: priceVisible ? 0 : 1 }]} pointerEvents="none">
        {ASTERISK_PLACEHOLDERS.map((key) => (
          <Asterisk key={key} color={colors.textPrimary} width={12} height={12} />
        ))}
        <EyeOpen color={colors.textPrimary} width={24} height={24} style={styles.eye} />
      </View>
    ),
    [colors.textPrimary, priceVisible],
  );

  if (totalPriceValue === null) {
    return <Skeleton width={140} height={45} startX={16} />;
  }

  const formatted = truncate(totalPriceValue, 2);

  return (
    <Pressable
      onPress={() => setPriceVisible(!priceVisible)}
      disabled={priceVisible === undefined}
      style={({ pressed }) => [styles.totalPriceContainer, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
      testID="totalPrice"
    >
      <Asterisks />
      <Text style={[styles.totalPriceText, { color: colors.textPrimary, opacity: priceVisible ? 1 : 0 }]} numberOfLines={1}>
        ${numberWithCommas(formatted)}
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

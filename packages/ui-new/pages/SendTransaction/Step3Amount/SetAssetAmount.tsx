import ProhibitIcon from '@assets/icons/prohibit.svg';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import { ASSET_TYPE, type AssetTypeValue } from '@core/types';
import { trimDecimalZeros } from '@core/utils/balance';
import useFormatBalance from '@hooks/useFormatBalance';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItemsGrid';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { useTheme } from '@react-navigation/native';
import type { INftItem } from '@service/core';
import Decimal from 'decimal.js';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { getLocalMaxInputAmount } from './amountInputHelpers';

interface Info {
  amount: string;
  isAmountValid: boolean;
  validMax: Decimal | null;
  handleEstimateMax: () => void;
  inEstimate: boolean;
  inMaxMode: boolean;
}

export type AmountInfo = Omit<Info, 'handleEstimateMax'>;

interface Props {
  asset: AmountAsset;
  nftItemDetail?: INftItem;
  onAmountInfoChange?: (info: AmountInfo) => void;
  defaultAmount?: string;
  defaultInMaxMode?: boolean;
  children?: (info: Info) => React.ReactNode;
  isReceive?: boolean;
  resolvedMaxAmount?: string | null;
  isAmountValidOverride?: boolean | null;
  errorMessageOverride?: string | null;
  onRequestMax?: () => Promise<string | null>;
  maxLoading?: boolean;
}

export interface AmountAsset {
  type: AssetTypeValue | string;
  contractAddress?: string;
  name?: string;
  symbol: string;
  decimals: number;
  balanceBaseUnits: string;
  icon?: string;
  priceInUSDT?: string;
  priceValue?: string;
}

const SetAssetAmount: React.FC<Props> = ({
  asset,
  nftItemDetail,
  onAmountInfoChange,
  children,
  defaultAmount,
  defaultInMaxMode,
  isReceive,
  resolvedMaxAmount,
  isAmountValidOverride,
  errorMessageOverride,
  onRequestMax,
  maxLoading = false,
}) => {
  const { colors, reverseColors } = useTheme();
  const { t } = useTranslation();
  const [amount, setAmount] = useState(() => defaultAmount ?? '');
  const needMaxMode = useMemo(() => !isReceive && (asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20), [isReceive, asset.type]);
  const [inMaxMode, setInMaxMode] = useState(() => defaultInMaxMode ?? false);
  const assetResetKey = `${asset.type}:${asset.contractAddress ?? ''}:${asset.symbol}:${nftItemDetail?.tokenId ?? ''}`;

  useEffect(() => {
    if (!assetResetKey) {
      return;
    }
    setAmount(defaultAmount ?? '');
    setInMaxMode(defaultInMaxMode ?? false);
  }, [assetResetKey, defaultAmount, defaultInMaxMode]);

  const balance = useFormatBalance(asset.balanceBaseUnits, asset.decimals);
  const symbol = useMemo(() => (nftItemDetail ? getDetailSymbol(nftItemDetail) : asset.symbol), [asset.symbol, nftItemDetail]);
  const validMax = useMemo(() => {
    if (isReceive) {
      return new Decimal(Number.POSITIVE_INFINITY);
    }

    if (resolvedMaxAmount == null) {
      return null;
    }

    try {
      return new Decimal(resolvedMaxAmount).mul(nftItemDetail ? new Decimal(1) : Decimal.pow(10, asset.decimals));
    } catch {
      return null;
    }
  }, [asset.decimals, isReceive, nftItemDetail, resolvedMaxAmount]);

  const handleClickMax = useCallback(async () => {
    const maxAmount =
      onRequestMax == null
        ? getLocalMaxInputAmount({
            balanceBaseUnits: asset.balanceBaseUnits,
            decimals: asset.decimals,
            ownedNftAmount: nftItemDetail?.amount,
          })
        : await onRequestMax();

    if (maxAmount !== null) {
      setAmount(maxAmount);
      if (needMaxMode) {
        setInMaxMode(true);
      }
    }
  }, [asset.balanceBaseUnits, asset.decimals, needMaxMode, nftItemDetail?.amount, onRequestMax]);

  const Suffix = useMemo(() => {
    const hasNft = !!nftItemDetail;
    const icon = hasNft ? nftItemDetail?.icon : asset.icon;
    return (
      <View style={styles.suffix}>
        {hasNft ? (
          <NFTIcon style={[styles.assetIcon, { borderRadius: 2 }]} source={icon} />
        ) : (
          <TokenIcon style={[styles.assetIcon, { borderRadius: 48 }]} source={icon} />
        )}

        {!isReceive && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
            <Pressable
              style={[
                styles.maxBtn,
                {
                  backgroundColor: inMaxMode ? colors.textPrimary : 'transparent',
                  borderColor: inMaxMode ? 'transparent' : colors.textPrimary,
                },
              ]}
              onPress={handleClickMax}
              disabled={maxLoading}
              testID="max"
            >
              <Text style={[styles.text, { color: inMaxMode ? reverseColors.textPrimary : colors.textPrimary, opacity: maxLoading ? 0 : 1 }]}>
                {t('common.max')}
              </Text>
              {maxLoading && <HourglassLoading style={styles.maxLoading} />}
            </Pressable>
          </>
        )}
      </View>
    );
  }, [asset.icon, colors.borderPrimary, colors.textPrimary, handleClickMax, inMaxMode, isReceive, maxLoading, nftItemDetail, reverseColors.textPrimary, t]);

  const receiveValidationError = useMemo(() => {
    if (!isReceive || !amount) return null;

    try {
      if (new Decimal(amount).lessThanOrEqualTo(0)) return 'less-than-zero';
      if (nftItemDetail) {
        return /^-?\d+$/.test(amount) ? null : 'nft-pure-integer';
      }
      return /^-?\d+(\.\d+)?$/.test(amount) ? null : 'unvalid-number-format';
    } catch {
      return 'unvalid-number-format';
    }
  }, [amount, isReceive, nftItemDetail]);

  const isAmountValid = useMemo(() => {
    if (isReceive) {
      return receiveValidationError === null;
    }

    if (!amount && !inMaxMode) {
      return null;
    }

    return isAmountValidOverride ?? null;
  }, [amount, inMaxMode, isAmountValidOverride, isReceive, receiveValidationError]);

  const errorMessage = useMemo(() => {
    if (isReceive) {
      if (!receiveValidationError) {
        return null;
      }

      return t('tx.amount.error.invalidAmount');
    }

    return errorMessageOverride ?? null;
  }, [errorMessageOverride, isReceive, receiveValidationError, t]);

  useEffect(() => {
    if (typeof onAmountInfoChange === 'function') {
      onAmountInfoChange({
        inMaxMode,
        amount,
        isAmountValid: isAmountValid === true,
        validMax,
        inEstimate: maxLoading,
      });
    }
  }, [amount, inMaxMode, isAmountValid, maxLoading, onAmountInfoChange, validMax]);

  const price = useMemo(() => {
    if (isAmountValid !== true || !isReceive) return '';
    return trimDecimalZeros(new Decimal(asset.priceInUSDT || 0).mul(new Decimal(amount || 0)).toFixed(2));
  }, [amount, asset.priceInUSDT, isAmountValid, isReceive]);

  return (
    <>
      <TextInput
        keyboardType="numeric"
        containerStyle={[styles.textinput, { borderColor: isAmountValid === true || isAmountValid === null ? colors.borderFourth : colors.down }]}
        showVisible={false}
        defaultHasValue={false}
        value={amount}
        onChangeText={(_amount) => {
          const newAmount = _amount?.trim();
          setAmount(newAmount);
          if (inMaxMode) {
            setInMaxMode(false);
          }
        }}
        isInBottomSheet
        showClear={!!amount}
        placeholder={isReceive ? t('tx.amount.anyAmount') : asset.type === ASSET_TYPE.ERC1155 ? '0' : '0.00'}
        SuffixIcon={Suffix}
      />
      {!isReceive && (
        <Text style={[styles.text, styles.balance, { color: colors.textPrimary }]} numberOfLines={3}>
          {t('common.balance')}: {nftItemDetail ? nftItemDetail.amount : balance} {symbol}
        </Text>
      )}
      {isReceive && !!price && price !== '0' && (
        <Text style={[styles.text, styles.balance, { color: colors.textPrimary }]} numberOfLines={1}>
          ≈ <Text style={{ color: colors.textPrimary }}>${price}</Text>
        </Text>
      )}

      {errorMessage && (
        <View style={styles.errorTip}>
          <ProhibitIcon style={styles.errorIcon} />
          <Text style={[styles.errorTipText, { color: colors.down }]}>{errorMessage}</Text>
        </View>
      )}
      {typeof children === 'function' &&
        children({
          amount,
          isAmountValid: isAmountValid === true,
          validMax,
          inEstimate: maxLoading,
          inMaxMode,
          handleEstimateMax: handleClickMax,
        })}
    </>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  textinput: {
    paddingRight: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  balance: {
    marginTop: 16,
  },
  assetIcon: {
    width: 24,
    height: 24,
  },
  suffix: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  maxBtn: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 34,
    borderWidth: 1,
    borderRadius: 6,
  },
  maxLoading: {
    width: 20,
    height: 20,
    position: 'absolute',
  },
  errorTip: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
  },
  errorIcon: {
    marginRight: 4,
  },
  errorTipText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
});

export default SetAssetAmount;

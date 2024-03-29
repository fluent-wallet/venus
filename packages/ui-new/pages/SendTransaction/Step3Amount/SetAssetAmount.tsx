/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import Decimal from 'decimal.js';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker';
import { useCurrentNetwork, useCurrentAddressValue, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import plugins from '@core/WalletCore/Plugins';
import { trimDecimalZeros } from '@core/utils/balance';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import HourglassLoading from '@components/Loading/Hourglass';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';

interface Info {
  amount: string;
  isAmountValid: boolean;
  validMax: Decimal | null;
  handleEstimateMax: () => void;
  inEstimate: boolean;
}
interface Props {
  targetAddress: string;
  asset: AssetInfo;
  nftItemDetail?: NFTItemDetail;
  onAmountInfoChange?: (info: Omit<Info, 'handleEstimateMax'>) => void;
  defaultAmount?: string;
  children?: (info: Info) => React.ReactNode;
  isReceive?: boolean;
}

const SetAssetAmount: React.FC<Props> = ({ targetAddress, asset, nftItemDetail, onAmountInfoChange, children, defaultAmount, isReceive }) => {
  const { colors } = useTheme();
  const currentNetwork = useCurrentNetwork()!;
  const currentAddressValue = useCurrentAddressValue()!;
  const [amount, setAmount] = useState(() => defaultAmount ?? '');
  const [validMax, setValidMax] = useState<Decimal | null>(() => (isReceive ? new Decimal(Infinity) : null));

  useEffect(() => {
    setAmount('');
  }, [asset?.contractAddress]);

  const balance = useFormatBalance(asset.balance, asset.decimals);
  const symbol = useMemo(() => {
    if (!nftItemDetail) {
      return asset.symbol;
    } else return getDetailSymbol(nftItemDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _handleEstimateMax = useCallback(async (isInit = false) => {
    if (asset.type !== AssetType.Native) {
      if (nftItemDetail) {
        const res = new Decimal(nftItemDetail.amount);
        setValidMax(res);
        return res;
      } else {
        const res = new Decimal(asset.balance);
        setValidMax(res);
        return res;
      }
    } else {
      try {
        const { gasLimit, gasPrice } = await plugins.Transaction.estimate({
          tx: { to: targetAddress, value: '0x0', from: currentAddressValue },
          network: currentNetwork!,
        });
        let res = new Decimal(asset.balance).sub(new Decimal(gasLimit).mul(new Decimal(gasPrice)));
        res = res.greaterThan(0) ? res : new Decimal(0);
        setValidMax(res);
        return res;
      } catch (err) {
        if (!isInit) {
          showMessage({
            message: 'Failed to estimate, please try again',
            description: String(err ?? ''),
            type: 'warning',
          });
        }
      }
    }
  }, []);
  const { inAsync: inEstimate, execAsync: handleEstimateMax } = useInAsync(_handleEstimateMax);

  const handleClickMax = useCallback(async () => {
    let usedMax: Decimal | null | undefined = validMax;
    if (usedMax === null) {
      usedMax = await handleEstimateMax(false);
    }
    if (usedMax) {
      setAmount(usedMax.div(Decimal.pow(10, nftItemDetail ? 0 : asset.decimals)).toString());
    }
  }, [validMax]);

  useEffect(() => {
    if (!isReceive) {
      handleEstimateMax(true);
    }
  }, []);

  const Suffix = useCallback(
    () => (
      <View style={styles.suffix}>
        {nftItemDetail ? (
          <NFTIcon style={[styles.assetIcon, { borderRadius: 2 }]} source={(nftItemDetail ?? asset).icon} />
        ) : (
          <TokenIcon style={[styles.assetIcon, { borderRadius: 48 }]} source={(nftItemDetail ?? asset).icon} />
        )}

        {!isReceive && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
            <Pressable
              style={({ pressed }) => [styles.maxBtn, { backgroundColor: pressed ? colors.underlay : 'transparent', borderColor: colors.textPrimary }]}
              onPress={handleClickMax}
              disabled={inEstimate}
            >
              <Text style={[styles.text, { color: colors.textPrimary, borderColor: colors.textPrimary, opacity: inEstimate ? 0 : 1 }]}>Max</Text>
              {inEstimate && <HourglassLoading style={styles.maxLoading} />}
            </Pressable>
          </>
        )}
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isAmountValid = useMemo(() => {
    if (!validMax || !amount) return null;
    if (nftItemDetail) {
      if (!/^-?\d+$/.test(amount)) {
        return 'nft-pure-integer';
      }
    } else {
      if (!/^-?\d+(\.\d+)?$/.test(amount)) {
        return 'unvalid-number-format';
      }
    }
    if (new Decimal(amount).lessThan(new Decimal(0))) return 'less-than-zero';
    return validMax.greaterThanOrEqualTo(new Decimal(amount).mul(nftItemDetail ? new Decimal(1) : Decimal.pow(10, asset.decimals)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, validMax]);

  useEffect(() => {
    if (typeof onAmountInfoChange === 'function') {
      onAmountInfoChange({
        amount,
        isAmountValid: isAmountValid === true,
        validMax: validMax,
        inEstimate,
      });
    }
  }, [amount, isAmountValid, validMax]);

  const price = useMemo(
    () => (isAmountValid !== true || !isReceive ? '' : trimDecimalZeros(new Decimal(asset.priceInUSDT || 0).mul(new Decimal(amount || 0)).toFixed(2))),
    [asset?.priceInUSDT, isAmountValid, amount],
  );
  return (
    <>
      <TextInput
        keyboardType="numeric"
        containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
        showVisible={false}
        defaultHasValue={false}
        value={amount}
        onChangeText={(newNickName) => setAmount(newNickName?.trim())}
        isInBottomSheet
        showClear={!!amount}
        placeholder={asset.type === AssetType.ERC1155 ? '0' : '0.00'}
        SuffixIcon={<Suffix />}
      />
      {!isReceive && (
        <Text style={[styles.text, styles.balance, { color: colors.textPrimary }]} numberOfLines={3}>
          Balance: {nftItemDetail ? nftItemDetail.amount : balance} {symbol}
        </Text>
      )}
      {isReceive && !!price && price !== '0' && (
        <Text style={[styles.text, styles.balance, { color: colors.textPrimary }]} numberOfLines={1}>
          ≈ <Text style={{ color: colors.textPrimary }}>${price}</Text>
        </Text>
      )}

      {isAmountValid !== true && isAmountValid !== null && (
        <Text style={[styles.errorTip, { color: colors.textPrimary }]}>
          🚫{' '}
          {isAmountValid === false
            ? `Insufficient ${symbol} balance`
            : isAmountValid === 'less-than-zero'
              ? 'Invalid amount'
              : isAmountValid === 'nft-pure-integer'
                ? 'Invalid amount'
                : 'Invalid amount'}
        </Text>
      )}
      {typeof children === 'function' &&
        children({
          amount,
          isAmountValid: isAmountValid === true,
          validMax: validMax!,
          inEstimate,
          handleEstimateMax: handleEstimateMax as unknown as () => void,
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
    marginHorizontal: 16,
    paddingRight: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  balance: {
    marginTop: 16,
    paddingHorizontal: 16,
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
    marginTop: 32,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
});

export default SetAssetAmount;

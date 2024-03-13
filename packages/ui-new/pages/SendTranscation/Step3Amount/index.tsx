import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import Decimal from 'decimal.js';
import { useCurrentNetwork, useCurrentAddressValue, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import plugins from '@core/WalletCore/Plugins';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import { AccountItemView } from '@modules/AccountsList';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { SendTransactionStep3StackName, SendTransactionStep4StackName, type SendTransactionScreenProps } from '@router/configs';
import BackupBottomSheet from '../SendTranscationBottomSheet';

const SendTranscationStep3Amount: React.FC<SendTransactionScreenProps<typeof SendTransactionStep3StackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const currentNetwork = useCurrentNetwork()!;
  const currentAddressValue = useCurrentAddressValue()!;

  const [amount, setAmount] = useState('');
  const [validMax, setValidMax] = useState<Decimal | null>(null);

  const balance = useFormatBalance(route.params.asset.balance, route.params.asset.decimals);
  const symbol = useMemo(() => {
    if (!route.params.nftItemDetail) {
      return route.params.asset.symbol;
    } else return getDetailSymbol(route.params.nftItemDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _handleEstimateMax = useCallback(async (isInit: boolean) => {
    if (route.params.asset.type !== AssetType.Native) {
      if (route.params.nftItemDetail) {
        const res = new Decimal(route.params.nftItemDetail.amount);
        setValidMax(res);
        return res;
      } else {
        const res = new Decimal(route.params.asset.balance);
        setValidMax(res);
        return res;
      }
    } else {
      try {
        const { gasLimit, gasPrice } = await plugins.Transaction.estimate({
          tx: { to: route.params.targetAddress, value: '0x0', from: currentAddressValue },
          network: currentNetwork,
        });
        const res = new Decimal(route.params.asset.balance).sub(new Decimal(gasLimit).mul(new Decimal(gasPrice)));
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
  const { inAsync, execAsync: handleEstimateMax } = useInAsync(_handleEstimateMax);

  const handleClickMax = useCallback(async () => {
    let usedMax: Decimal | null | undefined = validMax;
    if (usedMax === null) {
      usedMax = await handleEstimateMax(false);
    }
    if (usedMax) {
      setAmount(usedMax.div(Decimal.pow(10, route.params.nftItemDetail ? 0 : route.params.asset.decimals)).toString());
    }
  }, [validMax]);

  useEffect(() => {
    handleEstimateMax(true);
  }, []);

  const Suffix = useCallback(
    () => (
      <View style={styles.suffix}>
        {route.params.nftItemDetail ? (
          <NFTIcon style={[styles.assetIcon, { borderRadius: 2 }]} source={(route.params.nftItemDetail ?? route.params.asset).icon} />
        ) : (
          <TokenIcon style={[styles.assetIcon, { borderRadius: 48 }]} source={(route.params.nftItemDetail ?? route.params.asset).icon} />
        )}

        <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
        <Pressable
          style={({ pressed }) => [styles.maxBtn, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          onPress={handleClickMax}
          disabled={inAsync}
        >
          <Text style={[styles.text, { color: colors.textPrimary, borderColor: colors.textPrimary, opacity: inAsync ? 0 : 1 }]}>Max</Text>
          {inAsync && <HourglassLoading style={styles.maxLoading} />}
        </Pressable>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isAmountValid = useMemo(() => {
    if (!validMax || !amount) return null;
    if (route.params.nftItemDetail) {
      if (!/^-?\d+$/.test(amount)) {
        return 'nft-pure-integer';
      }
    } else {
      if (!/^-?\d+(\.\d+)?$/.test(amount)) {
        return 'unvalid-number-format';
      }
    }
    if (new Decimal(amount).lessThan(new Decimal(0))) return 'less-than-zero';
    return validMax.greaterThanOrEqualTo(
      new Decimal(amount).mul(route.params.nftItemDetail ? new Decimal(1) : Decimal.pow(new Decimal(10), new Decimal(route.params.asset.decimals))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, validMax]);

  return (
    <BackupBottomSheet onClose={navigation.goBack}>
      {route.params.nftItemDetail && (
        <>
          <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>Send</Text>
          <NFT colors={colors} asset={route.params.asset} nftItemDetail={route.params.nftItemDetail} />
        </>
      )}

      <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>To</Text>
      <AccountItemView nickname={''} addressValue={route.params.targetAddress} colors={colors} mode={mode} />

      <Text style={[styles.text, styles.amount, { color: colors.textSecondary }]}>Amount</Text>
      <TextInput
        keyboardType="numeric"
        containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
        showVisible={false}
        defaultHasValue={false}
        value={amount}
        onChangeText={(newNickName) => setAmount(newNickName?.trim())}
        isInBottomSheet
        showClear={!!amount}
        placeholder={route.params.asset.type === AssetType.ERC1155 ? '0' : '0.00'}
        SuffixIcon={<Suffix />}
      />
      <Text style={[styles.text, styles.balance, { color: colors.textPrimary }]} numberOfLines={3}>
        Balance: {route.params.nftItemDetail ? route.params.nftItemDetail.amount : balance} {symbol}
      </Text>

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
      <Button
        style={styles.btn}
        mode="auto"
        disabled={validMax !== null && isAmountValid !== true}
        onPress={validMax === null ? () => handleEstimateMax(false) : () => navigation.navigate(SendTransactionStep4StackName, { ...route.params, amount })}
        size="small"
      >
        {validMax === null ? 'Estimate Max' : 'Next'}
      </Button>
    </BackupBottomSheet>
  );
};

export const NFT: React.FC<{ colors: ReturnType<typeof useTheme>['colors']; asset: AssetInfo; nftItemDetail: NFTItemDetail }> = ({
  colors,
  asset,
  nftItemDetail,
}) => (
  <View style={styles.nftItem}>
    <NFTIcon style={styles.nftItemImg} source={nftItemDetail.icon} isNftItem placeholderContentFit="cover" contentFit="cover" />
    <Text style={[styles.nftAssetName, { color: colors.textSecondary }]}>{asset.name}</Text>
    <Text style={[styles.nftItemName, { color: colors.textPrimary }]}>{getDetailSymbol(nftItemDetail)}</Text>
  </View>
);

const styles = StyleSheet.create({
  nftItem: {
    marginTop: 14,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: 60,
    paddingLeft: 92,
    paddingRight: 16,
  },
  nftItemImg: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 60,
    height: 60,
    borderRadius: 2,
  },
  nftAssetName: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
  },
  nftItemName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  to: {
    marginTop: 24,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  amount: {
    marginTop: 22,
    marginBottom: 16,
    paddingHorizontal: 16,
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
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default SendTranscationStep3Amount;

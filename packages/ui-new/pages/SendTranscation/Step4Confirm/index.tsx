import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { formatUnits } from 'ethers';
import Decimal from 'decimal.js';
import { useCurrentNetwork, useCurrentAddressValue, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import plugins from '@core/WalletCore/Plugins';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import Button from '@components/Button';
import HourglassLoading from '@components/Loading/Hourglass';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import { AccountItemView } from '@modules/AccountsList';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { SendTranscationStep4StackName, HomeStackName, type SendTranscationScreenProps } from '@router/configs';
import BackupBottomSheet from '../SendTranscationBottomSheet';

const SendTranscationStep4Confirm: React.FC<SendTranscationScreenProps<typeof SendTranscationStep4StackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const currentNetwork = useCurrentNetwork()!;
  const currentAddressValue = useCurrentAddressValue()!;

  const balance = useFormatBalance(route.params.asset.balance, route.params.asset.decimals);
  const symbol = useMemo(() => {
    if (!route.params.nftItemDetail) {
      return route.params.asset.symbol;
    } else return getDetailSymbol(route.params.nftItemDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BackupBottomSheet showTitle="Transaction Confirm"  onClose={navigation.goBack}>
      <Text style={[styles.sendTitle, { color: colors.textPrimary }]}>↗️  Send</Text>
      <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>Amount</Text>
      <Text style={[styles.text, styles.balance, { color: colors.textPrimary }]} numberOfLines={3}>
        Balance: {route.params.nftItemDetail ? route.params.nftItemDetail.amount : balance} {symbol}
      </Text>

      <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>To</Text>
      <AccountItemView nickname={''} addressValue={route.params.targetAddress} colors={colors} mode={mode} />

      <AccountItemView nickname="Signing with" addressValue={currentAddressValue} colors={colors} mode={mode} />

      <View>
        <Button>Cancel</Button>
        <Button>Send</Button>
      </View>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  sendTitle: {
    marginTop: 16,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
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

export default SendTranscationStep4Confirm;

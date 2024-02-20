import { Pressable, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Web3WalletTypes } from '@walletconnect/web3wallet';
import { formatEther, isAddress, isHexString, parseEther, toUtf8String } from 'ethers';
import { useCallback, useMemo } from 'react';
import { sanitizeTypedData } from './sanitizeTypedData';
import Decimal from 'decimal.js';

interface SignTransaction {
  payload: Web3WalletTypes.SessionRequest['params'];
}

const SignTransaction: React.FC<SignTransaction> = ({ payload }) => {
  const {
    request: { method, params },
  } = payload;
  const tx = useMemo(() => {
    const txObj = params[0];
    return txObj || {};
  }, [params]);

  return (
    <View>
      <View style={style.header}></View>
      <View>
        <View style={style.txItem}>
          <Text>From:</Text>
          <Text>{tx.from}</Text>
        </View>
        <View style={style.txItem}>
          <Text>To:</Text>
          <Text>{tx.to}</Text>
        </View>
        <View style={style.txItem}>
          <Text>Amount</Text>
          <Text>{new Decimal(tx.value || 0).toString()}</Text>
        </View>
        <View style={style.txItem}>
          <Text>Data:</Text>
          <Text>{tx.data}</Text>
        </View>
      </View>
    </View>
  );
};

const style = StyleSheet.create({
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  txItem: {
    display: 'flex',
    flexDirection: 'row',
  },
});

export default SignTransaction;

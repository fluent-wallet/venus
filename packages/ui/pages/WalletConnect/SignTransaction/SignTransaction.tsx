import { Pressable, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Web3WalletTypes } from '@walletconnect/web3wallet';
import { Transaction, formatEther, isAddress, isHexString, parseEther, toUtf8String } from 'ethers';
import { useCallback, useMemo } from 'react';
import { sanitizeTypedData } from './sanitizeTypedData';
import Decimal from 'decimal.js';
import { BaseButton } from '@components/Button';
import useProvider from '@hooks/useProvider';
import { useCurrentAddress, useCurrentNetwork, useVaultOfAccount, useCurrentAccount } from '@core/WalletCore/Plugins/ReactInject';
import VaultType from '@core/database/models/Vault/VaultType';
import BSIM from '@WalletCoreExtends/Plugins/BSIM';
import { HexStringType } from '@core/WalletCore/Plugins/Transaction/types';
import Methods from '@core/WalletCore/Methods';

interface SignTransaction {
  payload: Web3WalletTypes.SessionRequest['params'];
  onSignTx: (txHash: string) => void;
  onCancel: () => void;
}

const SignTransaction: React.FC<SignTransaction> = ({ payload, onCancel, onSignTx }) => {
  const {
    request: { method, params },
  } = payload;

  const provider = useProvider();

  const currentAccount = useCurrentAccount()!;
  const vault = useVaultOfAccount(currentAccount?.id);
  const currentAddress = useCurrentAddress()!;
  const currentNetwork = useCurrentNetwork()!;
  const tx = useMemo(() => {
    const txObj = params[0];
    return txObj || {};
  }, [params]);

  const handleSignTx = useCallback(async () => {
    const transaction = new Transaction();

    transaction.to = tx.to;
    transaction.value = tx.value;
    transaction.data = tx.data;
    transaction.nonce = await provider.getTransactionCount(currentAddress?.hex);
    const gas = await provider.fetchFeeInfo({ from: currentAddress.hex, to: tx.to, value: tx.value, data: tx.data });
    transaction.gasPrice = gas.gasPrice;
    transaction.gasLimit = gas.gas;
    transaction.chainId = currentNetwork.chainId;
    transaction.type = 0;

    if (vault.type === VaultType.BSIM) {
      const hash = await BSIM.signTransaction(currentAddress.hex, transaction);
      // const txHash = await provider.broadcastTransaction(hash as HexStringType);
      onSignTx(hash);
    } else {
      const pk = await Methods.getPrivateKeyOfVault(vault);
      const signer = await provider.getSigner(pk);
      const hash = await signer.signTransaction(transaction);
      onSignTx(hash);
    }
  }, [currentAddress.hex, currentNetwork.chainId, provider, tx.data, tx.to, tx.value, onSignTx, vault]);

  return (
    <View>
      <View style={style.header}></View>
      <View>
        <View style={style.txItem}>
          <Text>From: </Text>
          <Text>{tx.from}</Text>
        </View>
        <View style={style.txItem}>
          <Text>To: </Text>
          <Text>{tx.to}</Text>
        </View>
        <View style={style.txItem}>
          <Text>Amount: </Text>
          <Text>{new Decimal(tx.value || 0).toString()}</Text>
        </View>
        <View style={style.txItem}>
          <Text>Data: </Text>
          <Text>{tx.data}</Text>
        </View>
      </View>

      <View style={style.buttons}>
        <BaseButton containerStyle={{ flex: 1 }} onPress={onCancel}>
          Cancel
        </BaseButton>
        <BaseButton containerStyle={{ flex: 1 }} onPress={handleSignTx}>
          Confirm
        </BaseButton>
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
    marginBottom: 10,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'row',
  },
});

export default SignTransaction;

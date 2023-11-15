import { Button, Divider, Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { Pressable, SafeAreaView, View } from 'react-native';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import Warning from '@assets/icons/warning_2.svg';
import { HomeStackName, RootStackList, WalletStackName, type StackNavigation } from '@router/configs';

import CloseIcon from '@assets/icons/close.svg';
import SendIcon from '@assets/icons/send.svg';
import { BaseButton } from '@components/Button';
import { withDatabase, withObservables } from '@nozbe/watermelondb/react';
import { Database } from '@nozbe/watermelondb';
import { querySelectedAddress } from '@core/DB/models/Address/service';
import { Address } from '@core/DB/models/Address';
import { map, switchMap } from 'rxjs';
import { RouteProp } from '@react-navigation/native';
import { shortenAddress } from '@core/utils/address';
import { querySelectedNetwork } from '@core/DB/models/Network/service';
import { Network } from '@core/DB/models/Network';
import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { TokenType, transactionAtom } from '@hooks/useTransaction';
import { JsonRpcProvider, Transaction, formatUnits, parseUnits } from 'ethers';

import { firstValueFrom } from 'rxjs';
import { RPCResponse, RPCSend, RPCSendFactory } from '@core/utils/send';
import { iface777 } from '@core/utils';

import { Wallet } from 'ethers';

export const TransactionConfirmStackName = 'TransactionConfirm';

const TransactionConfirm: React.FC<{
  navigation: StackNavigation;
  address: Address;
  route: RouteProp<RootStackList, typeof TransactionConfirmStackName>;
  currentNetwork: Network;
}> = ({ navigation, address, route, currentNetwork }) => {
  const { theme } = useTheme();
  const [error, setError] = useState('');
  const [tx] = useAtom(transactionAtom);
  const [gas, setGas] = useState<{ gasLimit: string; gasPrice: string } | null>(null);

  const handleSend = async () => {
    if (gas && tx.contract) {
      const transaction = new Transaction();

      transaction.chainId = currentNetwork.chainId;
      transaction.to = tx.contract;
      transaction.gasLimit = gas.gasLimit;
      transaction.gasPrice = gas.gasPrice;

      const nonce = await firstValueFrom(
        RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getTransactionCount', params: [address.hex, 'pending'] })
      );
      transaction.nonce = nonce.result;
      if (gas && tx.tokenType === TokenType.ERC20) {
        transaction.data = iface777.encodeFunctionData('transfer', [tx.to, parseUnits(tx.amount.toString())]);
      }
      const pk = await address.getPrivateKey();
      const wallet = new Wallet(pk, new JsonRpcProvider(currentNetwork.endpoint));

      wallet.sendTransaction(transaction).then(() => {
        navigation.navigate(HomeStackName, { screen: WalletStackName });
      });
    }
  };

  useEffect(() => {
    if (tx.tokenType === TokenType.ERC20 && tx.contract) {
      const encodeData = iface777.encodeFunctionData('transfer', [tx.to, parseUnits(tx.amount.toString())]);
      firstValueFrom(
        RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getTransactionCount', params: [address.hex, 'pending'] }).pipe(
          map((res) => res.result),
          switchMap((nonce) =>
            RPCSend<RPCResponse<string>[]>(currentNetwork.endpoint, [
              {
                method: 'eth_estimateGas',
                params: [
                  {
                    from: address.hex,
                    nonce,
                    to: tx.contract,
                    data: encodeData,
                  },
                ],
              },
              { method: 'eth_gasPrice' },
            ])
          ),
          map(([gas, gasPrice]) => ({ gasLimit: gas.result, gasPrice: gasPrice.result }))
        )
      ).then((res) => setGas(res));
    }

    // firstValueFrom(RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_gasPrice' })).then((data) => console.log(data));
  }, [currentNetwork.endpoint, tx.tokenType, tx.contract, tx.to, tx.amount, address.hex]);
  const gasCost = gas ? BigInt(gas.gasLimit) * BigInt(gas.gasPrice) : 0n;
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      {error && (
        <Pressable onPress={() => setError('')}>
          <View className="flex flex-row p-3 items-center border rounded-lg mb-4" style={{ borderColor: theme.colors.warnErrorPrimary }}>
            <Warning width={16} height={16} />
            <View className="flex-1 ml-2">
              <Text className="text-sm leading-6" style={{ color: theme.colors.warnErrorPrimary }}>
                {error}
              </Text>
            </View>
          </View>
        </Pressable>
      )}
      <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md">
        <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
          From
        </Text>
        <View className="flex flex-row items-center my-2">
          <View className="mr-2">
            <AvatarIcon width={24} height={24} />
          </View>
          <Text>{shortenAddress(address.hex)}</Text>
          <View className="m-1">
            <CopyAllIcon width={16} height={16} />
          </View>
        </View>
        <Text className="ml-8 leading-6" style={{ color: theme.colors.textSecondary }}>
          Balance: {formatUnits(tx.balance, tx.decimals)} {tx.symbol}
        </Text>

        <Divider className="my-4" />

        <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
          To
        </Text>
        <View className="flex flex-row items-center my-2">
          <View className="mr-2">
            <AvatarIcon width={24} height={24} />
          </View>
          <Text>{shortenAddress(tx.to)}</Text>
          <View className="m-1">
            <CopyAllIcon width={16} height={16} />
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md">
        <View className="flex flex-row justify-between">
          <Text className=" leading-6" style={{ color: theme.colors.textSecondary }}>
            Amount
          </Text>
          <View className="flex">
            <Text style={{ color: theme.colors.textPrimary }} className="text-xl font-bold leading-6">
              {tx.amount} {tx.symbol}
            </Text>
            <Text style={{ color: theme.colors.textSecondary }} className="text-right text-sm leading-6">
              {tx.priceInUSDT ? `≈$${Number(tx.priceInUSDT) * tx.amount}` : ''}
            </Text>
          </View>
        </View>

        <View className="flex flex-row justify-between">
          <Text className=" eading-6" style={{ color: theme.colors.textSecondary }}>
            Estimate Gas Cost
          </Text>
          <View className="flex">
            <Text style={{ color: theme.colors.textPrimary }} className="text-xl font-bold leading-6">
              {formatUnits(gasCost)} CFX
            </Text>
            <Text style={{ color: theme.colors.textSecondary }} className="text-right text-sm leading-6">
              {/* todo */}
            </Text>
          </View>
        </View>

        <View className="flex flex-row justify-between">
          <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
            Network
          </Text>
          <Text className="leading-6">{currentNetwork.name}</Text>
        </View>
      </View>

      <View className="flex flex-row items-center mt-auto">
        <Button type="outline" buttonStyle={{ width: 48, height: 48, borderRadius: 40, marginRight: 15 }} onPress={() => navigation.goBack()}>
          <CloseIcon />
        </Button>
        <View className="flex-1">
          <BaseButton disabled={!gas} onPress={handleSend}>
            <SendIcon color="#fff" width={24} height={24} />
            Send
          </BaseButton>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default withDatabase(
  withObservables([], ({ database }: { database: Database }) => {
    return {
      address: querySelectedAddress(database)
        .observe()
        .pipe(map((address) => address?.[0])),
      currentNetwork: querySelectedNetwork(database)
        .observe()
        .pipe(map((network) => network?.[0])),
    };
  })(TransactionConfirm)
);

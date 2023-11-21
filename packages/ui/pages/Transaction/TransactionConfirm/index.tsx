import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, View, Image } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { map, switchMap, firstValueFrom } from 'rxjs';
import { JsonRpcProvider, Transaction, formatUnits, parseUnits } from 'ethers';
import { Button, Divider, Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { Wallet } from 'ethers';
import WalletCore from '@core/WalletCore';
import { useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import { type RootStackList, type StackNavigation } from '@router/configs';
import { HomeStackName } from '@router/index';
import { WalletStackName } from '@pages/Wallet';
import { RPCResponse, RPCSend, RPCSendFactory } from '@core/utils/send';
import { BaseButton } from '@components/Button';
import { TokenType, transactionAtom } from '@hooks/useTransaction';
import { iface721, iface777 } from '@core/contracts';
import CloseIcon from '@assets/icons/close.svg';
import SendIcon from '@assets/icons/send.svg';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import Warning from '@assets/icons/warning_2.svg';

export const TransactionConfirmStackName = 'TransactionConfirm';

const TransactionConfirm: React.FC<{
  navigation: StackNavigation;
  route: RouteProp<RootStackList, typeof TransactionConfirmStackName>;
}> = ({ navigation, route }) => {
  const { theme } = useTheme();

  const currentNetwork = useCurrentNetwork()!;
  const currentAddress = useCurrentAddress()!;

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
        RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getTransactionCount', params: [currentAddress.hex, 'pending'] })
      );
      transaction.nonce = nonce.result;
      if (gas && tx.tokenType === TokenType.ERC20) {
        transaction.data = iface777.encodeFunctionData('transfer', [tx.to, parseUnits(tx.amount.toString())]);
      }
      if (gas && tx.tokenType === TokenType.ERC721 && tx.tokenId) {
        transaction.data = iface721.encodeFunctionData('transferFrom', [currentAddress.hex, tx.to, tx.tokenId]);
      }

      const pk = await WalletCore.methods.getPrivateKeyOfAddress(currentAddress);
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
        RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getTransactionCount', params: [currentAddress.hex, 'pending'] }).pipe(
          map((res) => res.result),
          switchMap((nonce) =>
            RPCSend<RPCResponse<string>[]>(currentNetwork.endpoint, [
              {
                method: 'eth_estimateGas',
                params: [
                  {
                    from: currentAddress.hex,
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

    if (tx.tokenType === TokenType.ERC721 && tx.contract && tx.tokenId) {
      const encodeData = iface721.encodeFunctionData('transferFrom', [currentAddress.hex, tx.to, tx.tokenId]);
      firstValueFrom(
        RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getTransactionCount', params: [currentAddress.hex, 'pending'] }).pipe(
          map((res) => res.result),
          switchMap((nonce) =>
            RPCSend<RPCResponse<string>[]>(currentNetwork.endpoint, [
              {
                method: 'eth_estimateGas',
                params: [
                  {
                    from: currentAddress.hex,
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
  }, [currentNetwork.endpoint, tx.tokenType, tx.contract, tx.to, tx.amount, currentAddress.hex, tx.tokenId]);

  const renderAmount = () => {
    if (tx.tokenType === TokenType.ERC20) {
      return `${tx.amount} ${tx.symbol}`;
    }
    if (tx.tokenType === TokenType.ERC721) {
      return `1 ${tx.contractName}`;
    }
  };

  const gasCost = gas ? BigInt(gas.gasLimit) * BigInt(gas.gasPrice) : 0n;
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      {tx.tokenType === TokenType.ERC721 && (
        <View className="flex flex-row p-4 rounded-lg w-full" style={{ backgroundColor: theme.colors.surfaceCard }}>
          {tx.tokenImage && <Image source={{ uri: tx.tokenImage }} width={63} height={63} className="mr-4" />}
          <View className="flex justify-center">
            {tx.iconUrl && <Image source={{ uri: tx.iconUrl }} width={24} height={24} />}
            <Text style={{ color: theme.colors.textSecondary }} className="leading-6">
              {tx.contractName}
            </Text>
            <Text style={{ color: theme.colors.textPrimary }} className="leading-6 font-medium">
              {tx.nftName}
            </Text>
          </View>
        </View>
      )}
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
          <Text>{shortenAddress(currentAddress.hex)}</Text>
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
              {renderAmount()}
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

export default TransactionConfirm;

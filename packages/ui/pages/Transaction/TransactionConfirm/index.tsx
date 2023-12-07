import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, View, Image } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import { Button, Divider, Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import { type RootStackList, type StackNavigation, WalletStackName, HomeStackName, TransactionConfirmStackName } from '@router/configs';
import { BaseButton } from '@components/Button';
import CloseIcon from '@assets/icons/close.svg';
import SendIcon from '@assets/icons/send.svg';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import Warning from '@assets/icons/warning_2.svg';
import { transactionAtom } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import MixinImage from '@components/MixinImage';
import { AssetType } from '@core/database/models/Asset';
import Methods from '@core/WalletCore/Methods';
import Events from '@core/WalletCore/Events';
import DefaultNFTImage from '@assets/images/NFT.svg';

const TransactionConfirm: React.FC<{
  navigation: StackNavigation;
  route: RouteProp<RootStackList, typeof TransactionConfirmStackName>;
}> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const currentNetwork = useCurrentNetwork()!;
  const currentAddress = useCurrentAddress()!;

  const [error, setError] = useState('');
  const [tx] = useAtom(transactionAtom);
  const [gas, setGas] = useState<{ gasLimit: string; gasPrice: string } | null>(null);

  const handleSend = async () => {
    if (gas) {
      setLoading(true);
      try {
        const { txHash, txRaw, transaction } = await Methods.sendTransaction(tx, gas);

        Events.broadcastTransactionSubjectPush.next({
          txHash,
          txRaw,
          transaction,
        });
        navigation.navigate(HomeStackName, { screen: WalletStackName });
        setLoading(false);
      } catch (error) {
        console.log(error);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    Methods.getTransactionGasAndGasLimit({ to: tx.to, amount: tx.amount, assetType: tx.assetType, contract: tx.contract, tokenId: tx.tokenId })
      .then((res) => setGas(res))
      .catch((err) => {
        console.log('getTransactionGasAndGasLimit error', err);
        // TODO maybe we need show the error to user
      });
  }, [currentNetwork.endpoint, tx.assetType, tx.contract, tx.to, tx.amount, currentAddress.hex, tx.tokenId]);

  const renderAmount = () => {
    if (tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.Native || tx.assetType === AssetType.ERC1155) {
      return `${tx.amount} ${tx.symbol}`;
    }
    if (tx.assetType === AssetType.ERC721) {
      return `1 ${tx.contractName}`;
    }
  };

  const gasCost = gas ? BigInt(gas.gasLimit) * BigInt(gas.gasPrice) : 0n;
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px] pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      {(tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155) && (
        <View className="flex flex-row p-4 rounded-lg w-full mb-4" style={{ backgroundColor: theme.colors.surfaceCard }}>
          {tx.tokenImage && <Image source={{ uri: tx.tokenImage }} width={63} height={63} className="mr-4" />}
          <View className="flex justify-center">
            <View className="flex flex-row mb-1">
              <View className="w-6 h-6 overflow-hidden rounded-full mr-2">
                {tx.iconUrl ? <MixinImage source={{ uri: tx.iconUrl }} width={24} height={24} /> : <DefaultNFTImage width={24} height={24} />}
              </View>
              <Text style={{ color: theme.colors.textSecondary }} className="leading-normal">
                {tx.contractName}
              </Text>
            </View>
            <Text style={{ color: theme.colors.textPrimary }} className="leading-normal font-medium">
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
          Balance: {tx.assetType === AssetType.ERC20 ? formatUnits(tx.balance, tx.decimals) : tx.balance} {tx.symbol}
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
              {/*  price todo */}
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
          <BaseButton loading={loading} disabled={!gas} onPress={handleSend}>
            <SendIcon color="#fff" width={24} height={24} />
            Send
          </BaseButton>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default TransactionConfirm;

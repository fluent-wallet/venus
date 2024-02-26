import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, View, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { Subject } from 'rxjs';
import { Transaction, TransactionRequest, ethers, formatUnits } from 'ethers';
import { Button, Divider, Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { useCurrentAccount, useCurrentAddress, useCurrentNetwork, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import { type RootStackList, type StackNavigation, WalletStackName, HomeStackName, TransactionConfirmStackName } from '@router/configs';
import { BaseButton } from '@components/Button';
import CloseIcon from '@assets/icons/close.svg';
import NoNetwork from '@modules/NoNetwork';
import SendIcon from '@assets/icons/send.svg';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import Warning from '@assets/icons/warning_2.svg';
import MixinImage from '@components/MixinImage';
import { AssetType } from '@core/database/models/Asset';
import Methods from '@core/WalletCore/Methods';
import Events from '@core/WalletCore/Events';
import DefaultNFTImage from '@assets/images/NFT.svg';
import VaultType from '@core/database/models/Vault/VaultType';
import BSIMSendTX from './SendTX';
import { BSIMErrorEndTimeout, BSIM_ERRORS } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import EstimateGas from './EstimateGas';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import Decimal from 'decimal.js';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNetInfo } from '@react-native-community/netinfo';
import { showMessage } from 'react-native-flash-message';
import { updateNFTDetail } from '@modules/AssetList/ESpaceNFTList/fetch';
import assetsTracker from '@core/WalletCore/Plugins/AssetsTracker';
import ConfluxNetworkIcon from '@assets/icons/confluxNet.svg';
import { balanceFormat } from '@core/utils/balance';
import { useAssetsHash } from '@core/WalletCore/Plugins/ReactInject/data/useAssets';

import { iface777 } from '@core/contracts';
import ERC721 from '@core/contracts/ABI/ERC721';
import ERC777 from '@core/contracts/ABI/ERC777';
import ERC1155 from '@core/contracts/ABI/ERC1155';
import BSIM from '@WalletCoreExtends/Plugins/BSIM';
import { type HexStringType } from '@core/WalletCore/Plugins/Transaction/types';
import { TxEvent, TxEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import useProvider from '@hooks/useProvider';

const TransactionConfirm: React.FC<{
  navigation: StackNavigation;
  route: RouteProp<RootStackList, typeof TransactionConfirmStackName>;
}> = ({ navigation, route }) => {
  const txParams = route.params;
  const { theme } = useTheme();
  const { isConnected } = useNetInfo();
  const [loading, setLoading] = useState(false);
  const currentNetwork = useCurrentNetwork()!;
  const currentAddress = useCurrentAddress()!;
  const currentAccount = useCurrentAccount()!;
  const currentVault = useVaultOfAccount(currentAccount?.id);
  const assetsHash = useAssetsHash();
  const provider = useProvider();

  const txEvent = useRef(new Subject<TxEvent>());

  const [error, setError] = useState('');

  const [gas, setGas] = useState<{ gasLimit?: bigint; gasPrice?: bigint; loading: boolean; error: boolean; errorMsg?: string }>({
    loading: true,
    error: false,
  });

  const price = useMemo(() => {
    if (txParams.priceInUSDT) {
      const n = new Decimal(formatUnits(txParams.amount, txParams.decimals)).mul(new Decimal(txParams.priceInUSDT));
      if (n.lessThan(new Decimal(10).pow(-2))) {
        return '<$0.01';
      }
      return `$${balanceFormat(n.toString(), { decimals: 0, truncateLength: 2 })}`;
    }
    return '';
  }, [txParams.priceInUSDT, txParams.amount, txParams.decimals]);

  const pushBroadcastTransactionEvent = useCallback(
    (txHash: string, txRaw: string, transaction: Transaction) => {
      Events.broadcastTransactionSubjectPush.next({
        txHash,
        txRaw,
        transaction: transaction,
        extraParams: {
          assetType: txParams.assetType,
          contractAddress: txParams.contractAddress,
          to: txParams.to,
          sendAt: new Date(),
        },
      });
    },
    [txParams.assetType, txParams.contractAddress, txParams.to],
  );

  const finishTx = useCallback(() => {
    showMessage({
      type: 'success',
      message: 'Transaction Submitted',
      description: 'Waiting for execution',
      icon: 'loading' as unknown as undefined,
    });

    navigation.navigate(HomeStackName, { screen: WalletStackName });
  }, [navigation]);

  const handleSend = async () => {
    if (gas?.gasLimit && gas.gasPrice) {
      setLoading(true);

      try {
        const sendTransaction = new Transaction();
        sendTransaction.to = txParams.to;
        sendTransaction.chainId = currentNetwork.chainId;
        sendTransaction.gasLimit = gas.gasLimit;
        sendTransaction.gasPrice = gas.gasPrice;
        sendTransaction.type = 0; // eSpace only support legacy transaction by now
        sendTransaction.data = '0x';

        // get nonce
        const nonce = await provider.getTransactionCount(currentAddress.hex);
        sendTransaction.nonce = nonce;
        // get value or data
        if (txParams.assetType === AssetType.Native) {
          sendTransaction.to = txParams.to;
          sendTransaction.value = txParams.amount;
        } else {
          // is contract need to encode data
          if (!txParams.contractAddress) throw new Error(`send ${txParams.assetType} need contract address`);
          if (txParams.assetType === AssetType.ERC20) {
            sendTransaction.to = txParams.contractAddress;
            sendTransaction.data = await provider.encodeFunctionData({ abi: ERC777, functionName: 'transfer', args: [txParams.to, txParams.amount] });
          } else if (txParams.assetType === AssetType.ERC721) {
            sendTransaction.to = txParams.contractAddress;
            sendTransaction.data = await provider.encodeFunctionData({
              abi: ERC721,
              functionName: 'transferFrom',
              args: [currentAddress.hex, txParams.to, txParams.tokenId],
            });
          } else if (txParams.assetType === AssetType.ERC1155) {
            sendTransaction.to = txParams.contractAddress;
            sendTransaction.data = await provider.encodeFunctionData({
              abi: ERC1155,
              functionName: 'safeTransferFrom',
              args: [currentAddress.hex, txParams.to, txParams.tokenId, txParams.amount, '0x'],
            });
          } else {
            throw new Error('unknown asset type');
          }
        }

        // sign tx
        if (currentVault.type === VaultType.BSIM) {
          try {
            txEvent.current.next({ type: TxEventTypesName.BSIM_VERIFY_START });
            txEvent.current.next({ type: TxEventTypesName.BSIM_SIGN_START });
            // sendTransaction has from field, but it is readonly, and it is only have by tx is signed otherwise it is null, so we need to pass the from address to signTransaction
            const txRaw = await BSIM.signTransaction(currentAddress.hex, sendTransaction);
            txEvent.current.next({ type: TxEventTypesName.BSIM_TX_SEND });
            const txHash = await provider.broadcastTransaction(txRaw as HexStringType);
            pushBroadcastTransactionEvent(txHash, txRaw, sendTransaction);
            finishTx();
          } catch (error: any) {
            console.log('BSIM error', error);
            setLoading(false);
            // error
            if (error.code) {
              const errorMsg = BSIM_ERRORS[error.code?.toUpperCase()];
              if (errorMsg) {
                txEvent.current.next({ type: TxEventTypesName.ERROR, message: errorMsg });
              } else {
                txEvent.current.next({ type: TxEventTypesName.ERROR, message: error?.message || BSIM_ERRORS.default });
              }
            } else {
              // not BSIM error
              txEvent.current.next({ type: TxEventTypesName.ERROR, message: error?.message || BSIM_ERRORS.default });
            }
          }
        } else {
          const pk = await Methods.getPrivateKeyOfAddress(currentAddress);
          const signer = await provider.getSigner(pk);
          const txRaw = await signer.signTransaction(sendTransaction);
          const txHash = await provider.broadcastTransaction(txRaw as HexStringType);
          pushBroadcastTransactionEvent(txHash, txRaw, sendTransaction);
          finishTx();
        }

        if (txParams.assetType === AssetType.ERC1155 || txParams.assetType === AssetType.ERC721) {
          updateNFTDetail(txParams.contractAddress);
          assetsTracker.updateCurrentTracker();
        } else {
          assetsTracker.updateCurrentTracker();
        }
      } catch (error: any) {
        console.log(error);
        setError(matchRPCErrorMessage({ message: error?.details || error?.message }));
        setLoading(false);
      }
      setLoading(false);
    }
  };
  const getGas = useCallback(async () => {
    setGas({ loading: true, error: false });
    try {
      if (txParams.assetType === AssetType.Native) {
        const gas = await provider.fetchFeeInfo({ from: currentAddress.hex, to: txParams.to, value: BigInt(txParams.amount) });
        return setGas({ gasLimit: gas?.gas, gasPrice: gas?.gasPrice, loading: false, error: false });
      } else {
        if (txParams.assetType === AssetType.ERC20 && txParams.contractAddress) {
          const data = await provider.encodeFunctionData({ abi: ERC777, functionName: 'transfer', args: [txParams.to, txParams.amount] });
          const gas = await provider.fetchFeeInfo({
            from: currentAddress.hex,
            to: txParams.contractAddress,
            value: 0n,
            data,
          });
          return setGas({ gasLimit: gas?.gas, gasPrice: gas?.gasPrice, loading: false, error: false });
        }
        if (txParams.assetType === AssetType.ERC721 && txParams.contractAddress) {
          const data = await provider.encodeFunctionData({
            abi: ERC721,
            functionName: 'transferFrom',
            args: [currentAddress.hex, txParams.to, txParams.tokenId],
          });
          const gas = await provider.fetchFeeInfo({ from: currentAddress.hex, to: txParams.contractAddress, value: 0n, data });
          return setGas({ gasLimit: gas?.gas, gasPrice: gas?.gasPrice, loading: false, error: false });
        }

        if (txParams.assetType === AssetType.ERC1155 && txParams.contractAddress) {
          const data = await provider.encodeFunctionData({
            abi: ERC1155,
            functionName: 'safeTransferFrom',
            args: [currentAddress.hex, txParams.to, txParams.tokenId, txParams.amount, '0x'],
          });
          const gas = await provider.fetchFeeInfo({ from: currentAddress.hex, to: txParams.contractAddress, value: 0n, data });
          return setGas({ gasLimit: gas?.gas, gasPrice: gas?.gasPrice, loading: false, error: false });
        }
      }
    } catch (error: any) {
      setGas({ loading: false, error: true, errorMsg: matchRPCErrorMessage({ message: error.details || error.message, data: error.data }) });
    }
  }, [txParams.assetType, txParams.contractAddress, txParams.to, txParams.amount, txParams.tokenId, currentAddress.hex, provider]);

  useEffect(() => {
    if (!isConnected) return;
    getGas();
  }, [currentNetwork.endpoint, currentAddress.hex, getGas, isConnected]);

  const renderAmount = () => {
    if (txParams.assetType === AssetType.ERC20 || txParams.assetType === AssetType.Native || txParams.assetType === AssetType.ERC1155) {
      return `${formatUnits(txParams.amount, txParams.decimals)} ${txParams.symbol}`;
    }
    if (txParams.assetType === AssetType.ERC721) {
      return `1 ${txParams.contractName}`;
    }
  };

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-startpb-7"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <NoNetwork />
      <ScrollView className="flex-1">
        {(error || gas.error) && (
          <View className="px-6">
            <Pressable onPress={() => setError('')}>
              <View className="flex flex-row p-3 items-start border rounded-lg mb-4" style={{ borderColor: theme.colors.warnErrorPrimary }}>
                <Warning width={16} height={16} />
                <View className="flex-1 ml-2">
                  <Text className="text-sm " style={{ color: theme.colors.warnErrorPrimary }}>
                    {error || gas.errorMsg}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        )}
        <View className="px-6">
          {(txParams.assetType === AssetType.ERC721 || txParams.assetType === AssetType.ERC1155) && (
            <View className="flex flex-row p-4 rounded-lg w-full mb-4" style={{ backgroundColor: theme.colors.surfaceCard }}>
              {txParams.tokenImage ? (
                <MixinImage
                  source={{ uri: txParams.tokenImage }}
                  width={63}
                  height={63}
                  className="mr-4 rounded"
                  fallback={<DefaultNFTImage width={63} height={63} />}
                />
              ) : (
                <DefaultNFTImage width={63} height={63} />
              )}
              <View className="flex justify-center ml-4">
                <View className="flex flex-row mb-1">
                  <View className="w-6 h-6 overflow-hidden rounded-full mr-2">
                    {txParams.iconUrl ? (
                      <MixinImage source={{ uri: txParams.iconUrl }} width={24} height={24} fallback={<DefaultNFTImage width={24} height={24} />} />
                    ) : (
                      <DefaultNFTImage width={24} height={24} />
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, maxWidth: 204 }} className="leading-normal">
                    {txParams.contractName}
                  </Text>
                </View>
                <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, maxWidth: 235 }} className="leading-normal font-medium">
                  {txParams.nftName}
                </Text>
              </View>
            </View>
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
              <Pressable onPress={() => Clipboard.setString(currentAddress.hex)}>
                <View className="m-1">
                  <CopyAllIcon color={theme.colors.textPrimary} width={16} height={16} />
                </View>
              </Pressable>
            </View>
            <Text className="ml-8 leading-6" style={{ color: theme.colors.textSecondary }}>
              Balance:{' '}
              {txParams.assetType === AssetType.ERC20 || txParams.assetType === AssetType.Native
                ? formatUnits(txParams.balance, txParams.decimals)
                : txParams.balance}{' '}
              {txParams.symbol}
            </Text>

            <Divider className="my-4" />

            <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
              To
            </Text>
            <View className="flex flex-row items-center my-2">
              <View className="mr-2">
                <AvatarIcon width={24} height={24} />
              </View>
              <Text>{shortenAddress(txParams.to)}</Text>
              <Pressable onPress={() => Clipboard.setString(txParams.to)}>
                <View className="m-1">
                  <CopyAllIcon color={theme.colors.textPrimary} width={16} height={16} />
                </View>
              </Pressable>
            </View>
          </View>

          <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md mt-4 mb-7">
            <View className="flex flex-row justify-between">
              <View className="shrink-0">
                <Text className=" w-20 leading-6" style={{ color: theme.colors.textSecondary }}>
                  Amount
                </Text>
              </View>
              <View className="flex-1">
                <Text style={{ color: theme.colors.textPrimary }} className="text-right text-xl font-bold leading-6">
                  {renderAmount()}
                </Text>
                <Text style={{ color: theme.colors.textSecondary }} className="text-right text-sm leading-6">
                  {price}
                </Text>
              </View>
            </View>

            <View className="flex flex-row justify-between">
              <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
                Estimate Gas Cost
              </Text>
              <View className="flex-1">
                <EstimateGas {...gas} retry={getGas} priceInUSDT={assetsHash && assetsHash[AssetType.Native] ? assetsHash[AssetType.Native].priceInUSDT : ''} />
              </View>
            </View>

            <View className="flex flex-row justify-between">
              <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
                Network
              </Text>
              <View className="flex flex-row items-center">
                <ConfluxNetworkIcon width={24} height={24} />
                <Text className="leading-6 ml-1">{currentNetwork.name}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      {currentVault?.type === VaultType.BSIM ? (
        <BSIMSendTX onSend={handleSend} txEvent={txEvent.current} />
      ) : (
        <View className="flex flex-row items-center mt-auto px-6 mb-6">
          <Button
            type="outline"
            buttonStyle={{ width: 48, height: 48, borderRadius: 40, marginRight: 15 }}
            onPress={() => navigation.navigate(HomeStackName, { screen: WalletStackName })}
          >
            <CloseIcon />
          </Button>
          <View className="flex-1">
            <BaseButton testID="send" loading={loading} disabled={!isConnected || !gas || !!error || !!gas.error} onPress={handleSend}>
              <SendIcon color="#fff" width={24} height={24} />
              Send
            </BaseButton>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default TransactionConfirm;

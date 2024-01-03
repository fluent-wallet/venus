import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, View, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { firstValueFrom } from 'rxjs';
import { formatUnits } from 'ethers';
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
import { TxEventTypesName, resetTransaction, useReadOnlyTransaction } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import MixinImage from '@components/MixinImage';
import { AssetType } from '@core/database/models/Asset';
import Methods from '@core/WalletCore/Methods';
import Events from '@core/WalletCore/Events';
import DefaultNFTImage from '@assets/images/NFT.svg';
import VaultType from '@core/database/models/Vault/VaultType';
import BSIMSendTX from './SendTX';
import { BSIMErrorEndTimeout, BSIM_ERRORS } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import EstimateGas from './EstimateGas';
import { RPCResponse, RPCSend } from '@core/utils/send';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import Decimal from 'decimal.js';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNetInfo } from '@react-native-community/netinfo';
import { showMessage } from 'react-native-flash-message';
import { updateNFTDetail } from '@modules/AssetList/ESpaceNFTList/fetch';
import assetsTracker from '@core/WalletCore/Plugins/AssetsTracker';
import ConfluxNetworkIcon from '@assets/icons/confluxNet.svg';
import { balanceFormat } from '@core/utils/balance';
import { useAtom } from 'jotai';

const TransactionConfirm: React.FC<{
  navigation: StackNavigation;
  route: RouteProp<RootStackList, typeof TransactionConfirmStackName>;
}> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { isConnected } = useNetInfo();
  const [loading, setLoading] = useState(false);
  const currentNetwork = useCurrentNetwork()!;
  const currentAddress = useCurrentAddress()!;
  const currentAccount = useCurrentAccount()!;
  const currentVault = useVaultOfAccount(currentAccount?.id);

  const [error, setError] = useState('');
  const tx = useReadOnlyTransaction();
  const [, resetTX] = useAtom(resetTransaction);
  const [gas, setGas] = useState<{ gasLimit?: string; gasPrice?: string; loading: boolean; error: boolean; errorMsg?: string }>({
    loading: true,
    error: false,
  });

  const price = useMemo(() => {
    if (tx.priceInUSDT) {
      const n = new Decimal(formatUnits(tx.amount, tx.decimals)).mul(new Decimal(tx.priceInUSDT));
      if (n.lessThan(new Decimal(10).pow(-2))) {
        return '<$0.01';
      }
      return `$${balanceFormat(n.toString(), { decimals: 0, truncateLength: 2 })}`;
    }
    return '';
  }, [tx.priceInUSDT, tx.amount, tx.decimals]);

  const handleSend = async () => {
    if (gas?.gasLimit && gas.gasPrice) {
      setLoading(true);
      try {
        try {
          const blockNumber = await firstValueFrom(RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_blockNumber' }));
          const { txHash, txRaw, transaction, error } = await Methods.sendTransaction(tx, { gasLimit: gas.gasLimit, gasPrice: gas.gasPrice });

          if (error && error.message && error.data) {
            const errorMsg = matchRPCErrorMessage({ message: error.message, data: error.data });
            tx.event.next({ type: TxEventTypesName.ERROR, message: errorMsg });
            setLoading(false);
            return setError(errorMsg);
          }

          Events.broadcastTransactionSubjectPush.next({
            txHash,
            txRaw,
            transaction,
            extraParams: {
              assetType: tx.assetType,
              contractAddress: tx.contractAddress,
              to: tx.to,
              blockNumber: blockNumber.result,
            },
          });

          if (tx.assetType === AssetType.ERC1155 || tx.assetType === AssetType.ERC721) {
            updateNFTDetail(tx.contractAddress);
            assetsTracker.updateCurrentTracker();
          } else {
            assetsTracker.updateCurrentTracker();
          }
          showMessage({
            type: 'success',
            message: 'Transaction Submitted',
            description: 'Waiting for execution',
            icon: 'loading' as unknown as undefined,
          });
          // tx send success then reset tx atom
          resetTX();

          navigation.navigate(HomeStackName, { screen: WalletStackName });
        } catch (error) {
          setLoading(false);
          // error
          if (error instanceof BSIMErrorEndTimeout) {
            console.log(error.code, 'sign Error code');
            console.log(error.message, 'sign Error message');
            const errorMsg = BSIM_ERRORS[error.code?.toUpperCase()];
            tx.event.next({ type: TxEventTypesName.ERROR, message: errorMsg });
          } else {
            // not BSIM error
            tx.event.next({ type: TxEventTypesName.ERROR, message: BSIM_ERRORS.default });
          }
        }
        setLoading(false);
      } catch (error) {
        console.log(error);
        setLoading(false);
      }
    }
  };
  const getGas = useCallback(() => {
    setGas({ loading: true, error: false });
    Methods.getTransactionGasAndGasLimit({
      to: tx.to,
      amount: tx.amount,
      assetType: tx.assetType,
      contractAddress: tx.contractAddress,
      tokenId: tx.tokenId,
      decimals: tx.decimals,
    })
      .then((res) => {
        if (!res.gasLimit.error && !res.gasPrice.error) {
          setGas({
            gasLimit: res.gasLimit.result,
            gasPrice: res.gasPrice.result,
            loading: false,
            error: false,
          });
        } else {
          setGas({
            loading: false,
            error: true,
            errorMsg: matchRPCErrorMessage({
              message: res.gasLimit?.error?.message || res.gasPrice?.error?.message || '',
              data: res.gasLimit?.error?.data || res.gasPrice?.error?.data || '',
            }),
          });
        }
      })
      .catch((err) => {
        console.log('getTransactionGasAndGasLimit error', err);
        setGas({ loading: false, error: true });
      });
  }, [tx.assetType, tx.contractAddress, tx.to, tx.amount, tx.tokenId, tx.decimals]);

  useEffect(() => {
    if (!isConnected) return;
    getGas();
  }, [currentNetwork.endpoint, currentAddress.hex, getGas, isConnected]);

  const renderAmount = () => {
    if (tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.Native || tx.assetType === AssetType.ERC1155) {
      return `${formatUnits(tx.amount, tx.decimals)} ${tx.symbol}`;
    }
    if (tx.assetType === AssetType.ERC721) {
      return `1 ${tx.contractName}`;
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
          {(tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155) && (
            <View className="flex flex-row p-4 rounded-lg w-full mb-4" style={{ backgroundColor: theme.colors.surfaceCard }}>
              {tx.tokenImage ? (
                <MixinImage
                  source={{ uri: tx.tokenImage }}
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
                    {tx.iconUrl ? (
                      <MixinImage source={{ uri: tx.iconUrl }} width={24} height={24} fallback={<DefaultNFTImage width={24} height={24} />} />
                    ) : (
                      <DefaultNFTImage width={24} height={24} />
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ color: theme.colors.textSecondary, maxWidth: 204 }} className="leading-normal">
                    {tx.contractName}
                  </Text>
                </View>
                <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, maxWidth: 235 }} className="leading-normal font-medium">
                  {tx.nftName}
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
              Balance: {tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.Native ? formatUnits(tx.balance, tx.decimals) : tx.balance} {tx.symbol}
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
              <Pressable onPress={() => Clipboard.setString(tx.to)}>
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
              <Text className=" eading-6" style={{ color: theme.colors.textSecondary }}>
                Estimate Gas Cost
              </Text>
              <EstimateGas {...gas} retry={getGas} priceInUSDT={tx.priceInUSDT} />
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
        <BSIMSendTX onSend={handleSend} txEvent={tx.event} />
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

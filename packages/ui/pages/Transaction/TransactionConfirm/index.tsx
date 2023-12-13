import { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, View, Image, useColorScheme } from 'react-native';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Subject, firstValueFrom, scan } from 'rxjs';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import { Button, Divider, Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { useCurrentAccount, useCurrentAddress, useCurrentNetwork, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
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
import VaultType from '@core/database/models/Vault/VaultType';
import { formatValue } from '@utils/formatValue';
import BSIMSendTX, { BSIM_SIGN_STATUS } from './SendTX';
import BSIM from 'packages/WalletCoreExtends/Plugins/BSIM';
import { BSIMTimeoutError, BSIM_ERRORS } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import EstimateGas from './EstimateGas';
import { RPCResponse, RPCSend } from '@core/utils/send';

const TransactionConfirm: React.FC<{
  navigation: StackNavigation;
  route: RouteProp<RootStackList, typeof TransactionConfirmStackName>;
}> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const currentNetwork = useCurrentNetwork()!;
  const currentAddress = useCurrentAddress()!;
  const currentAccount = useCurrentAccount()!;
  const currentVault = useVaultOfAccount(currentAccount?.id);
  const [BSIMTXState, setBSIMTXState] = useState(BSIM_SIGN_STATUS.INIT);
  const [BSIMTxError, setBSIMTxError] = useState('');

  const [error, setError] = useState('');
  const [tx] = useAtom(transactionAtom);
  const [gas, setGas] = useState<{ gasLimit?: string; gasPrice?: string; loading: boolean; error: boolean }>({ loading: true, error: false });

  const handleSend = async () => {
    if (gas?.gasLimit && gas.gasPrice) {
      setLoading(true);
      try {
        let channel;
        if (currentVault.type === VaultType.BSIM) {
          channel = new Subject<void>();
          channel.pipe(scan((acc) => acc + 1, 0)).subscribe({
            next: (v) => {
              console.log('next state', v);
              const states = [BSIM_SIGN_STATUS.SIGNING, BSIM_SIGN_STATUS.COMPLETE];
              setBSIMTXState(states[v - 1]);
            },
          });
        }

        try {
          const blockNumber = await firstValueFrom(RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_blockNumber' }));
          const { txHash, txRaw, transaction } = await Methods.sendTransaction(tx, { gasLimit: gas.gasLimit, gasPrice: gas.gasPrice }, channel);

          Events.broadcastTransactionSubjectPush.next({
            txHash,
            txRaw,
            transaction,
            extraParams: {
              assetType: tx.assetType,
              contract: tx.contract,
              to: tx.to,
              blockNumber: blockNumber.result,
            },
          });
          navigation.navigate(HomeStackName, { screen: WalletStackName });
        } catch (error) {
          // error
          if (channel) {
            if (error instanceof BSIMTimeoutError) {
              const errorMsg = BSIM_ERRORS[(error as Error).message];
              setBSIMTxError(errorMsg);
            } else {
              // not BSIM error
              setBSIMTxError(BSIM_ERRORS.default);
            }
            setBSIMTXState(BSIM_SIGN_STATUS.ERROR);
          }
        }

        navigation.navigate(HomeStackName, { screen: WalletStackName });
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
      contract: tx.contract,
      tokenId: tx.tokenId,
      decimals: tx.decimals,
    })
      .then((res) => {
        if (!res.gasLimit.error && !res.gasPrice.error) {
          setGas({ gasLimit: res.gasLimit.result, gasPrice: res.gasPrice.result, loading: false, error: false });
        } else {
          // TODO how error message to user
          setGas({ loading: false, error: true });
        }
      })
      .catch((err) => {
        console.log('getTransactionGasAndGasLimit error', err);
        setGas({ loading: false, error: true });
        // TODO maybe we need show the error to user
      });
  }, [tx.assetType, tx.contract, tx.to, tx.amount, tx.tokenId, tx.decimals]);

  useEffect(() => {
    getGas();
  }, [currentNetwork.endpoint, currentAddress.hex, getGas]);

  useFocusEffect(
    useCallback(() => {
      console.log("check if there's BSIM card ");
      if (currentVault?.type === VaultType.BSIM) {
        BSIM.getBSIMVersion().catch((e) => {
          setBSIMTXState(BSIM_SIGN_STATUS.NOT_HAVE_BSIM);
        });
      }
    }, [currentVault?.type])
  );

  const renderAmount = () => {
    if (tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.Native || tx.assetType === AssetType.ERC1155) {
      return `${tx.amount} ${tx.symbol}`;
    }
    if (tx.assetType === AssetType.ERC721) {
      return `1 ${tx.contractName}`;
    }
  };

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-startpb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <View className="px-6">
        {(tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155) && (
          <View className="flex flex-row p-4 rounded-lg w-full mb-4" style={{ backgroundColor: theme.colors.surfaceCard }}>
            {tx.tokenImage && <MixinImage source={{ uri: tx.tokenImage }} width={63} height={63} className="mr-4" />}
            <View className="flex justify-center">
              <View className="flex flex-row mb-1">
                <View className="w-6 h-6 overflow-hidden rounded-full mr-2">
                  {tx.iconUrl ? (
                    <MixinImage source={{ uri: tx.iconUrl }} width={24} height={24} fallback={<DefaultNFTImage width={24} height={24} />} />
                  ) : (
                    <DefaultNFTImage width={24} height={24} />
                  )}
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
            Balance: {tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.Native ? formatValue(tx.balance, tx.decimals) : tx.balance} {tx.symbol}
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

        <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-[15px] rounded-md mt-4">
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
            <EstimateGas {...gas} retry={getGas} />
          </View>

          <View className="flex flex-row justify-between">
            <Text className="leading-6" style={{ color: theme.colors.textSecondary }}>
              Network
            </Text>
            <Text className="leading-6">{currentNetwork.name}</Text>
          </View>
        </View>
      </View>
      {currentVault?.type === VaultType.BSIM ? (
        <BSIMSendTX onSend={handleSend} state={BSIMTXState} errorMessage={BSIMTxError} />
      ) : (
        <View className="flex flex-row items-center mt-auto px-6 mb-6">
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
      )}
    </SafeAreaView>
  );
};

export default TransactionConfirm;

import { useMemo, useState } from 'react';
import { SafeAreaView, View, KeyboardAvoidingView, Image, TextInput, Pressable, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { formatUnits, parseUnits } from 'ethers';
import { shortenAddress } from '@core/utils/address';
import { Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { type StackNavigation, RootStackList, TransactionConfirmStackName, SendToStackName } from '@router/configs';
import { BaseButton } from '@components/Button';
import TokenIconDefault from '@assets/icons/defaultToken.svg';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import { AssetType } from '@core/database/models/Asset';
import { setTransactionAmount, useReadOnlyTransaction } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import MixinImage from '@components/MixinImage';
import Methods from '@core/WalletCore/Methods';
import WarningIcon from '@assets/icons/warning_2.svg';
import { useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { RPCResponse, RPCSend } from '@core/utils/send';
import { firstValueFrom } from 'rxjs';
import { Button } from '@rneui/base';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import { numberWithCommas } from '@core/utils/balance';
import DefaultNFTImage from '@assets/images/NFT.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import CFXTokenIcon from '@assets/icons/cfxToken.svg';
import { useNetInfo } from '@react-native-community/netinfo';
import NoNetwork from '@modules/NoNetwork';
import Decimal from 'decimal.js';

const SendTo: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof SendToStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { isConnected } = useNetInfo();
  const currentNetwork = useCurrentNetwork()!;
  const currentAddress = useCurrentAddress();
  const [, setTXAmount] = useAtom(setTransactionAmount);
  const tx = useReadOnlyTransaction();
  const [value, setValue] = useState(tx.amount ? formatUnits(tx.amount, tx.decimals) : '');
  const [invalidInputErr, setInvalidInputErr] = useState({ err: false, msg: '' });
  const [rpcError, setRpcError] = useState({ err: false, msg: '' });
  const [maxBtnLoading, setMaxBtnLoading] = useState(false);

  const accountBalance = useMemo(
    () => numberWithCommas(tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.Native ? formatUnits(tx.balance, tx.decimals) : tx.balance),
    [tx.assetType, tx.balance, tx.decimals]
  );

  const handleChange = (v: string) => {
    setInvalidInputErr({ err: false, msg: '' });

    if (tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155) {
      return setValue(v.replace(/[^0-9]/g, ''));
    }
    setValue(v);
  };

  const handleNext = () => {
    try {
      const DValue = new Decimal(value);
      if (DValue.lessThan(0)) {
        return setInvalidInputErr({ err: true, msg: 'Invalid amount' });
      }

      if (tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155) {
        if (DValue.lessThan(1)) {
          return setInvalidInputErr({ err: true, msg: 'Invalid amount' });
        }
      }

      if (
        DValue.greaterThan(
          new Decimal(tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.Native ? formatUnits(tx.balance, tx.decimals) : tx.balance)
        )
      ) {
        return setInvalidInputErr({ err: true, msg: 'Insufficient balance' });
      }

      setTXAmount(parseUnits(value, tx.decimals));
      navigation.navigate(TransactionConfirmStackName);
    } catch (error) {
      return setInvalidInputErr({ err: true, msg: 'Invalid amount' });
    }
  };

  const getNativeBalance = async () => {
    return firstValueFrom(RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getBalance', params: [currentAddress?.hex, 'latest'] }));
  };

  const getGas = async (amount: bigint) => {
    const gas = await Methods.getTransactionGasAndGasLimit({
      to: tx.to,
      amount: amount,
      assetType: tx.assetType,
      contractAddress: tx.contractAddress,
      tokenId: tx.tokenId,
      decimals: tx.decimals,
    });

    if (gas.gasLimit.error || gas.gasPrice.error) {
      const errorMsg = matchRPCErrorMessage({
        message: gas.gasLimit.error?.message || gas.gasPrice.error?.message || '',
        data: gas.gasLimit.error?.data || gas.gasPrice.error?.data || '',
      });
      setRpcError({ err: true, msg: errorMsg });
      return;
    }
    return gas;
  };

  const handleChangeMax = async () => {
    setMaxBtnLoading(true);
    if (tx.assetType === AssetType.Native && isConnected) {
      try {
        // there need to be a network connection to get the native balance
        const nativeBalance = await getNativeBalance();
        if (nativeBalance.error) {
          return setRpcError({ err: true, msg: nativeBalance.error.message || '' });
        }
        const balance = nativeBalance.result;
        const gas = await getGas(BigInt(balance));
        if (!gas) {
          return setMaxBtnLoading(false);
        }
        // if there is native asset, the max value should be the balance - gas fee
        const max = formatUnits(BigInt(balance) - BigInt(gas.gasLimit.result) * BigInt(gas.gasPrice.result), tx.decimals);
        setValue(max);
        setInvalidInputErr({ err: false, msg: '' });
      } catch (error) {
        console.log(error);
        setMaxBtnLoading(false);
      }
    }

    if (tx.assetType === AssetType.ERC20 || tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155) {
      setInvalidInputErr({ err: false, msg: '' });
      setValue(formatUnits(tx.balance, tx.decimals));
    }

    setMaxBtnLoading(false);
  };

  const isNFT = tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155;
  return (
    <SafeAreaView className="flex-1 " style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}>
      <NoNetwork />
      <View className="flex-1 px-[24px] pb-7">
        <KeyboardAvoidingView behavior="padding" className="flex-1 mt-1">
          <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {(rpcError.err || invalidInputErr.err) && (
              <View
                style={{ borderColor: theme.colors.warnErrorPrimary, borderWidth: 1, backgroundColor: theme.colors.surfaceCard }}
                className="flex flex-row p-3 rounded-lg"
              >
                <WarningIcon width={16} height={16} />
                <Text style={{ color: theme.colors.warnErrorPrimary }} className="flex-1 ml-2 text-sm">
                  {rpcError.msg || invalidInputErr.msg}
                </Text>
              </View>
            )}
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
                To
              </Text>
              <View className="flex flex-row items-center">
                <View className="m-2">
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

            <View className="mt-[13px]">
              <Text className="leading-6 ml-4 my-2">Amount</Text>
              <View
                style={{
                  backgroundColor: theme.colors.surfaceCard,
                  borderColor: invalidInputErr.err ? theme.colors.warnErrorPrimary : theme.colors.surfaceCard,
                  borderWidth: 1,
                }}
                className="flex flex-row items-center rounded-md px-4 py-2"
              >
                <TextInput
                  testID="amountInput"
                  keyboardType={'numeric'}
                  value={value}
                  onChangeText={handleChange}
                  onSubmitEditing={handleNext}
                  className="flex-1"
                  autoFocus
                />
                {tx.assetType === AssetType.Native ? (
                  <CFXTokenIcon width={24} height={24} />
                ) : tx.iconUrl ? (
                  <MixinImage
                    resizeMode="center"
                    source={{ uri: isNFT ? tx.tokenImage : tx.iconUrl }}
                    width={24}
                    height={24}
                    fallback={<TokenIconDefault width={24} height={24} />}
                  />
                ) : (
                  <TokenIconDefault width={24} height={24} />
                )}
              </View>
              <View className="flex flex-row justify-end items-center mt-2">
                <Text className="flex-1 leading-6" style={{ maxWidth: 274 }}>
                  Balance: {accountBalance} {tx.symbol}
                </Text>
                <View className="rounded-lg px-2 py-1 ml-2">
                  <Button
                    testID="maxAmount"
                    onPress={handleChangeMax}
                    buttonStyle={{ backgroundColor: theme.colors.surfaceBrand, borderRadius: 7 }}
                    loading={maxBtnLoading}
                  >
                    <Text style={{ color: theme.colors.textPrimary }}>MAX</Text>
                  </Button>
                </View>
              </View>
            </View>

            <View className="mt-auto mb-6">
              <BaseButton testID="next" disabled={invalidInputErr.err || rpcError.err} onPress={handleNext}>
                Next
              </BaseButton>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

export default SendTo;

import { useCallback, useMemo, useState } from 'react';
import { SafeAreaView, View, KeyboardAvoidingView, Image, TextInput, Pressable, ScrollView, BackHandler } from 'react-native';
import { RouteProp, useFocusEffect } from '@react-navigation/native';

import { formatUnits, parseUnits, toBeHex } from 'ethers';
import { shortenAddress } from '@core/utils/address';
import { Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { type StackNavigation, RootStackList, TransactionConfirmStackName, SendToStackName } from '@router/configs';
import { BaseButton } from '@components/Button';
import TokenIconDefault from '@assets/icons/defaultToken.svg';
import AvatarIcon from '@assets/icons/avatar.svg';
import CopyAllIcon from '@assets/icons/copy_all.svg';
import { AssetType } from '@core/database/models/Asset';
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
import useProvider from '@hooks/useProvider';

const SendTo: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof SendToStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { isConnected } = useNetInfo();
  const currentAddress = useCurrentAddress();
  const txParams = route.params;
  const [value, setValue] = useState(txParams.amount ? new Decimal(formatUnits(txParams.amount, txParams.decimals)).toString() : '');
  const [invalidInputErr, setInvalidInputErr] = useState({ err: false, msg: '' });
  const [rpcError, setRpcError] = useState({ err: false, msg: '' });
  const [maxBtnLoading, setMaxBtnLoading] = useState(false);

  const provider = useProvider()

  const accountBalance = useMemo(
    () =>
      numberWithCommas(
        txParams.assetType === AssetType.ERC20 || txParams.assetType === AssetType.Native ? formatUnits(txParams.balance, txParams.decimals) : txParams.balance,
      ),
    [txParams.assetType, txParams.balance, txParams.decimals],
  );

  const handleChange = (v: string) => {
    setInvalidInputErr({ err: false, msg: '' });

    if (txParams.assetType === AssetType.ERC721 || txParams.assetType === AssetType.ERC1155) {
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

      if (txParams.assetType === AssetType.ERC721 || txParams.assetType === AssetType.ERC1155) {
        if (DValue.lessThan(1)) {
          return setInvalidInputErr({ err: true, msg: 'Invalid amount' });
        }
      }

      if (
        DValue.greaterThan(
          new Decimal(
            txParams.assetType === AssetType.ERC20 || txParams.assetType === AssetType.Native
              ? formatUnits(txParams.balance, txParams.decimals)
              : txParams.balance,
          ),
        )
      ) {
        return setInvalidInputErr({ err: true, msg: 'Insufficient balance' });
      }

      navigation.navigate(TransactionConfirmStackName, { ...txParams, amount: parseUnits(value, txParams.decimals).toString() });
    } catch (error) {
      return setInvalidInputErr({ err: true, msg: 'Invalid amount' });
    }
  };


  const handleChangeMax = async () => {
    setMaxBtnLoading(true);
    if (txParams.assetType === AssetType.Native && isConnected) {
      try {
        // there need to be a network connection to get the native balance
        const nativeBalance = await provider.getBalance({ address: currentAddress?.hex || '' });

        const balance = nativeBalance;

        if (balance === BigInt(0)) {
          setMaxBtnLoading(false);
          return setValue('0');
        }
        const gasLimit = 21000n;
        const gasPrice = await provider.fetchGasPrice();

        if (!gasPrice) {
          return setMaxBtnLoading(false);
        }

        // if there is native asset, the max value should be the balance - gas fee
        const max = formatUnits(balance - gasLimit * gasPrice, txParams.decimals);
  
        setValue(max);
        setRpcError({ err: false, msg: '' });
        setInvalidInputErr({ err: false, msg: '' });
      } catch (error: any) {
        setRpcError({ err: true, msg: error.message || '' });
        setMaxBtnLoading(false);
      }
    }

    if (txParams.assetType === AssetType.ERC20 || txParams.assetType === AssetType.ERC721 || txParams.assetType === AssetType.ERC1155) {
      setInvalidInputErr({ err: false, msg: '' });
      setValue(formatUnits(txParams.balance, txParams.decimals));
    }

    setMaxBtnLoading(false);
  };

  const isNFT = txParams.assetType === AssetType.ERC721 || txParams.assetType === AssetType.ERC1155;
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
                To
              </Text>
              <View className="flex flex-row items-center">
                <View className="m-2">
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
                {txParams.assetType === AssetType.Native ? (
                  <CFXTokenIcon width={24} height={24} />
                ) : txParams.iconUrl ? (
                  <MixinImage
                    resizeMode="center"
                    source={{ uri: isNFT ? txParams.tokenImage : txParams.iconUrl }}
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
                  Balance: {accountBalance} {txParams.symbol}
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

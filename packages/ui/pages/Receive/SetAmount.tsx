import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, View, KeyboardAvoidingView, TextInput, TouchableWithoutFeedback } from 'react-native';
import { Icon } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';
import { useAtom } from 'jotai';
import setTokenQRInfoAtom from '@hooks/useSetAmount';
import { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenIcon from '@components/TokenIcon';
import { AssetType } from '@core/database/models/Asset';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackList } from '@router/configs';
import { Contract, parseUnits } from 'ethers';
import { firstValueFrom, from, switchMap, map, tap } from 'rxjs';
import { createFetchServer, fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { ChainType } from '@core/database/models/Network';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/utils/consts';
import {
  CFX_ESPACE_MAINNET_SCAN_OPENAPI,
  CFX_ESPACE_MAINNET_TOKEN_LIST_CONTRACT_ADDRESS,
  CFX_ESPACE_TESTNET_SCAN_OPENAPI,
  CFX_ESPACE_TESTNET_TOKEN_LIST_CONTRACT_ADDRESS,
} from '@core/consts/network';
import ESpaceTokenList from '@core/contracts/ABI/ESpaceTokenList';
import { useAssetsHash } from '@core/WalletCore/Plugins/ReactInject/data/useAssets';
import clsx from 'clsx';
import TokenItem from '@modules/AssetList/TokenList/TokenItem';

const SetAmount: React.FC<NativeStackScreenProps<RootStackList, 'SetAmount'>> = ({ navigation }) => {
  const { theme } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [value, setValue] = useState('');
  const [inputTextSize, setInputTextSize] = useState(60);
  const [currentToken, setCurrentToken] = useAtom(setTokenQRInfoAtom);
  const [inputError, setInputError] = useState(false);
  const currentNetwork = useCurrentNetwork()!;
  const assetsHash = useAssetsHash();
  const [list, setList] = useState<Omit<AssetInfo, 'balance'>[]>([]);
  const inputRef = useRef<TextInput>(null);

  const snapPoints = useMemo(() => ['25%', '50%'], []);

  const handleClose = () => {
    if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
      setSheetOpen((bl) => !bl);
    }
  };
  const handleSelectToken = () => {
    if (inputRef.current) {
      inputRef.current.blur();
    }

    if (bottomSheetRef.current) {
      if (sheetOpen) {
        bottomSheetRef.current.close();
      } else {
        bottomSheetRef.current.expand();
      }

      setSheetOpen((bl) => !bl);
    }
  };

  const handleChange = (v: string) => {
    if (v.length > 10) {
      setInputTextSize(30);
    } else {
      setInputTextSize(60);
    }

    if (/^\d*(\.\d*)?$/.test(v)) {
      const [integer, decimal] = v.split('.');
      if (integer.length > 24) return;
      if (decimal && decimal.length > 6) return;
      setValue(v);
    }

    if (isNaN(Number(v))) {
      setInputError(true);
    } else {
      setInputError(false);
    }
  };

  const handleChangeSelectedToken = (v: AssetInfo) => {
    setCurrentToken(v);
    bottomSheetRef.current?.close();
    setSheetOpen(false);
  };

  const handleContinue = () => {
    if (!value || isNaN(Number(value))) {
      return setInputError(true);
    }
    if (currentToken) {
      if (currentToken.type === AssetType.Native) {
        setCurrentToken({ ...currentToken, parameters: { value: currentToken.decimals ? parseUnits(value, currentToken.decimals) : BigInt(value) } });
      } else {
        setCurrentToken({
          ...currentToken,
          parameters: { address: currentToken.contractAddress, uint256: currentToken.decimals ? parseUnits(value, currentToken.decimals) : BigInt(value) },
        });
      }
    }
    navigation.goBack();
  };

  const getTokenList = useCallback(
    async (page = 0, pageSize = 200) => {
      if (currentNetwork.chainId !== CFX_ESPACE_MAINNET_CHAINID && currentNetwork.chainId !== CFX_ESPACE_TESTNET_CHAINID) {
        console.warn('token list contract not support chain');
        return [];
      }

      const tokenListContractAddress =
        currentNetwork.chainType === ChainType.Mainnet ? CFX_ESPACE_MAINNET_TOKEN_LIST_CONTRACT_ADDRESS : CFX_ESPACE_TESTNET_TOKEN_LIST_CONTRACT_ADDRESS;
      const tokenListContract = new Contract(tokenListContractAddress, ESpaceTokenList);

      const eSpaceTestnetServerFetcher = createFetchServer({ prefixUrl: CFX_ESPACE_TESTNET_SCAN_OPENAPI });
      const eSpaceServerFetcher = createFetchServer({ prefixUrl: CFX_ESPACE_MAINNET_SCAN_OPENAPI });

      const fetcher = currentNetwork.chainType === ChainType.Mainnet ? eSpaceServerFetcher : eSpaceTestnetServerFetcher;
      return firstValueFrom(
        from(
          fetchChain<string>({
            method: 'eth_call',
            url: currentNetwork.endpoint,
            params: [
              {
                to: tokenListContractAddress,
                data: tokenListContract.interface.encodeFunctionData('listTokens', [20n, BigInt(page * pageSize), BigInt(pageSize)]),
              },
            ],
          }),
        ).pipe(
          switchMap((encodeStr) => {
            const [_, list] = tokenListContract.interface.decodeFunctionResult('listTokens', encodeStr);
            return from(
              fetcher.fetchServer<{
                status: string;
                message: string;
                result: {
                  type: AssetType.ERC20;
                  contract: string;
                  name: string;
                  symbol: string;
                  decimals: number;
                  iconUrl: string;
                }[];
              }>({
                url: `token/tokeninfos?contracts=${list.join(',')}`,
              }),
            );
          }),
          map((res) => {
            if (res.status !== '1') return [];

            return res.result.map((item) => ({ ...item, icon: item.iconUrl }));
          }),
        ),
      );
    },
    [currentNetwork.endpoint, currentNetwork.chainType, currentNetwork.chainId],
  );
  useEffect(() => {
    getTokenList().then((res) => setList(res));
  }, []);
  const tokenList = assetsHash && assetsHash[AssetType.Native] ? [assetsHash[AssetType.Native], ...list] : list;
  return (
    <KeyboardAvoidingView behavior={'padding'} className="flex-1">
      <SafeAreaView
        className="flex flex-1  flex-col justify-start px-[24px] pb-6"
        style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
      >
        <Text className="text-xl text-center font-bold">Select a token</Text>

        <View className="flex">
          <Pressable
            testID="selectToken"
            className="flex flex-row items-center mx-auto px-3 py-2 min-w-[196px] rounded-[40px] border-[1px] mt-2"
            style={{ backgroundColor: theme.colors.pureBlackAndWight, borderColor: theme.colors.textBrand }}
            onPress={handleSelectToken}
          >
            <View className="flex flex-row items-center">
              <View className="mr-2">{currentToken && <TokenIcon type={currentToken.type} url={currentToken.icon} width={48} height={48} />}</View>
              <View>
                <Text>{currentToken?.name}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>{currentToken?.symbol}</Text>
              </View>
            </View>
            <View className="ml-auto">
              <Icon name="keyboard-arrow-down" color={theme.colors.surfaceFourth} size={24} />
            </View>
          </Pressable>
        </View>

        <TextInput
          testID="amountInput"
          autoFocus
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          inputMode="numeric"
          className="text-center text-6xl  font-bold leading-tight mt-[60px]"
          style={{
            color: theme.colors.textBrand,
            fontSize: inputTextSize,
            borderBottomWidth: 1,
            borderBottomColor: inputError ? theme.colors.warnErrorPrimary : 'transparent',
          }}
        />

        <Text style={{ color: theme.colors.textSecondary }} className="text-center">
          {currentToken?.symbol}
        </Text>
        {currentToken?.priceInUSDT && (
          <Text style={{ color: theme.colors.textSecondary }} className="text-center">
            {!inputError && `≈${(Number(value) * Number(currentToken.priceInUSDT)).toFixed(2)}`}
          </Text>
        )}

        <BaseButton testID="continue" containerStyle={{ marginTop: 'auto' }} disabled={inputError} onPress={handleContinue}>
          <Text style={{ color: theme.colors.textInvert }}>Continue</Text>
        </BaseButton>

        <BottomSheet
          index={-1}
          enablePanDownToClose
          ref={bottomSheetRef}
          snapPoints={snapPoints}
          handleStyle={{ backgroundColor: theme.colors.textSecondary }}
          backgroundStyle={{ backgroundColor: theme.colors.surfaceCard }}
          backdropComponent={({ style }) =>
            sheetOpen ? <Pressable onPress={handleClose} style={[{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }, style]}></Pressable> : null
          }
          handleComponent={() => (
            <View className="flex items-center">
              <View className="w-9 h-1 m-2 rounded" style={{ backgroundColor: theme.colors.textSecondary }} />
            </View>
          )}
        >
          {list && (
            <BottomSheetFlatList
              data={tokenList}
              renderItem={({ item, index }) => (
                <Pressable>
                  <View
                    className={clsx(
                      'relative flex flex-col justify-center items-center h-[72px] px-[10px] border-l-[1px] border-r-[1px] overflow-hidden',
                      index === 0 && 'rounded-t-[10px] border-t-[1px]',
                      index === list.length - 1 && 'rounded-b-[10px] border-b-[1px]',
                    )}
                    style={{ backgroundColor: theme.colors.pureBlackAndWight, borderColor: theme.colors.borderSecondary }}
                  >
                    <TokenItem hidePrice hideBalance data={{ ...item, balance: '0' }} onPress={handleChangeSelectedToken} />
                    {index !== 0 && <View className="absolute top-0 left-0 w-[120%] h-[1px]" style={{ backgroundColor: theme.colors.borderSecondary }} />}
                  </View>
                </Pressable>
              )}
            />
          )}
        </BottomSheet>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default SetAmount;

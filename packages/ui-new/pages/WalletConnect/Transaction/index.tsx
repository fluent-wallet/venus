import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {  formatEther } from 'ethers';
import { Interface } from '@ethersproject/abi';
import Decimal from 'decimal.js';
import { Image } from 'expo-image';
import {
  AssetSource,
  AssetType,
  NetworkType,
  useCurrentAccount,
  useCurrentAddressOfAccount,
  useCurrentAddressValue,
  useCurrentNetwork,
  useCurrentNetworkNativeAsset,
} from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import { processError } from '@core/utils/eth';
import { fetchERC20AssetInfoBatchWithAccount } from '@core/WalletCore/Plugins/AssetsTracker/fetchers/basic';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import Events from '@core/WalletCore/Events';
import { type IWCSendTransactionEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import { BSIMError } from '@WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import BottomSheet, { BottomSheetScrollView, BottomSheetView, snapPoints } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import Icon from '@components/Icon';
import useInAsync from '@hooks/useInAsync';
import { useGasEstimate } from '@hooks/useGasEstimate';
import { useSignTransaction } from '@hooks/useSignTransaction';
import { toDataUrl } from '@utils/blockies';
import { ParseTxDataReturnType, isApproveMethod, parseTxData } from '@utils/parseTxData';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import { WalletConnectParamList, WalletConnectTransactionStackName } from '@router/configs';
import EditAllowance from './EditAllowance';
import SendContract from './Contract';
import SendNativeToken from './NativeToken';

export type TxDataWithTokenInfo = ParseTxDataReturnType & {
  symbol?: string;
  balance?: string;
  decimals?: number;
};

function WalletConnectTransaction() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentNativeToken = useCurrentNetworkNativeAsset();
  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddressOfAccount(currentAccount?.id)!;
  const currentAddressValue = useCurrentAddressValue()!;
  const currentNetwork = useCurrentNetwork()!;

  const [errorMsg, setError] = useState('');
  const [parseData, setParseData] = useState<TxDataWithTokenInfo>();
  const [showEditAllowance, setShowEditAllowance] = useState(false);
  const [allowanceValue, setAllowanceValue] = useState('');

  const signTransaction = useSignTransaction();

  const epochHeightRef = useRef('');

  const navigation = useNavigation();
  const {
    params: {
      tx: { from, to, value, data, nonce, gasLimit, gasPrice },
      isContract,
      metadata,
    },
  } = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectTransactionStackName>>();

  const txData = useMemo(() => {
    if (allowanceValue && parseData?.functionName === 'approve' && isApproveMethod(parseData)) {
      // is approve and allowance value is set , so we need to encode the date
      const iface = new Interface([parseData.readableABI]);
      return iface.encodeFunctionData(parseData.functionName, [from, allowanceValue]);
    }
    return data;
  }, [allowanceValue, data, from, parseData]);
  const gasInfo = useGasEstimate({ from, to, value: value?.toString(), data: txData, nonce });

  const amount = useMemo(() => {
    return value ? formatEther(value) : '0';
  }, [value]);

  const _handleReject = useCallback(async () => {
    try {
      await plugins.WalletConnect.currentEventSubject.getValue()?.action.reject();
    } catch (e) {
      console.log(e);
    }
  }, []);

  const _handleApprove = useCallback(async () => {
    if (!gasInfo) return;
    setError('');

    let txHash;
    let txRaw;
    let txError;
    const tx = {
      from: currentAddressValue,
      to,
      value: value ? value : '0x0',
      data: txData || '0x',
      chainId: currentNetwork.chainId,
      type: plugins.Transaction.isOnlyLegacyTxSupport(currentNetwork.chainId) ? 0 : undefined,
    } as ITxEvm;

    const approve = plugins.WalletConnect.currentEventSubject.getValue()?.action.approve as IWCSendTransactionEvent['action']['approve'];
    try {
      const nonce = await plugins.Transaction.getTransactionCount({ network: currentNetwork, addressValue: currentAddressValue });
      tx.nonce = Number(nonce);
      tx.gasLimit = gasLimit ? gasLimit.toString() : gasInfo?.gasLimit;
      tx.gasPrice = gasPrice ? gasPrice.toString() : gasInfo?.gasPrice;

      if (currentNetwork.networkType === NetworkType.Conflux) {
        const currentEpochHeight = await plugins.BlockNumberTracker.getNetworkBlockNumber(currentNetwork);
        if (!epochHeightRef.current || !checkDiffInRange(BigInt(currentEpochHeight) - BigInt(epochHeightRef.current))) {
          epochHeightRef.current = currentEpochHeight;
        }
      }

      const { txRawPromise, cancel } = await signTransaction({ ...tx, epochHeight: epochHeightRef.current });

      txRaw = await txRawPromise;

      txHash = await plugins.Transaction.sendRawTransaction({ txRaw, network: currentNetwork });

      Events.broadcastTransactionSubjectPush.next({
        txHash,
        txRaw,
        tx,
        address: currentAddress,
        extraParams: {
          assetType: isContract ? AssetType.ERC20 : AssetType.Native, // TODO: update the assetType
          contractAddress: isContract ? to : undefined,
          to: to,
          sendAt: new Date(),
          epochHeight: currentNetwork.networkType === NetworkType.Conflux ? epochHeightRef.current : null,
        },
      });

      await approve(txHash);
      navigation.goBack();
    } catch (error: any) {
      if (error instanceof BSIMError) {
        if (error.code === 'cancel') {
          // ignore cancel error
          return; // nothing to do
        }
      }
      if (error === 'cancel') {
        // user cancel password verify
        return; // nothing to do
      }
      const msg = matchRPCErrorMessage(error);
      txError = error;
      setError(msg);
      // TODO: show error
    } finally {
      if (txRaw && txHash) {
        Events.broadcastTransactionSubjectPush.next({
          txHash,
          txRaw,
          tx,
          address: currentAddress,
          extraParams: {
            assetType: isContract ? undefined : AssetType.Native,
            contractAddress: isContract ? to : undefined,
            to: to,
            sendAt: new Date(),
            epochHeight: currentNetwork.networkType === NetworkType.Conflux ? epochHeightRef.current : null,
            err: txError && String(txError.data || txError?.message || txError),
            errorType: txError ? processError(txError).errorType : undefined,
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAddressValue, currentNetwork?.id, gasLimit, gasPrice, to, navigation, value, gasInfo, isContract, signTransaction, txData]);

  const gasCost = useMemo(() => {
    // if dapp not give gasPrice and rpcGasPrice is null, just return null

    const gasPriceVal = gasPrice || gasInfo?.gasPrice;
    const gasLimitVal = gasLimit || gasInfo?.gasLimit;
    if (!gasPriceVal || !gasLimitVal) return null;

    if (!currentNativeToken?.priceInUSDT) return null;

    const cost = new Decimal(gasLimitVal.toString()).mul(new Decimal(gasPriceVal.toString())).div(Decimal.pow(10, currentNativeToken?.decimals ?? 18));
    const priceInUSDT = currentNativeToken?.priceInUSDT ? cost.mul(new Decimal(currentNativeToken.priceInUSDT)) : null;

    return priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null;
  }, [gasPrice, currentNativeToken?.priceInUSDT, currentNativeToken?.decimals, gasLimit, gasInfo]);

  useEffect(() => {
    async function parseAndTryGetTokenInfo() {
      if (isContract) {
        const parseData = parseTxData({ data, to });
        if (to && parseData.functionName === 'approve' && parseData.assetType === AssetType.ERC20) {
          const remoteAsset = await fetchERC20AssetInfoBatchWithAccount({
            networkType: currentNetwork.networkType,
            endpoint: currentNetwork?.endpoint,
            contractAddress: to,
            accountAddress: currentAddress!,
          });
          const assetInfo = { ...remoteAsset, type: AssetType.ERC20, contractAddress: to };
          setParseData({ ...parseData, symbol: remoteAsset.symbol, balance: remoteAsset.balance, decimals: remoteAsset.decimals });
          const isInDB = await currentNetwork.queryAssetByAddress(to);
          if (!isInDB) {
            await methods.createAsset({
              network: currentNetwork,
              ...assetInfo,
              source: AssetSource.Custom,
            });
          }
        } else {
          setParseData(parseData);
        }
      }
    }
    parseAndTryGetTokenInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, to, isContract, currentNetwork.id, currentAddress, value]);

  const handleOpenEditAllowanceModel = useCallback(() => {
    if (parseData?.functionName === 'approve' && parseData?.assetType === AssetType.ERC20) {
      setShowEditAllowance(true);
    }
  }, [setShowEditAllowance, parseData]);

  const handleCloseEditAllowanceModel = useCallback(() => {
    setShowEditAllowance(false);
  }, [setShowEditAllowance]);

  const handleSaveEditAllowance = useCallback((value: string) => {
    setAllowanceValue(value);
  }, []);

  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);
  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);

  return (
    <>
      <BottomSheet isRoute snapPoints={snapPoints.percent75} style={styles.container} onClose={() => handleReject()}>
        <BottomSheetView style={styles.flex1}>
          <BottomSheetScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('wc.dapp.tx.title')}</Text>
            {isContract ? (
              <SendContract
                to={to}
                data={data}
                metadata={metadata}
                parseData={parseData}
                openEditAllowance={handleOpenEditAllowanceModel}
                customAllowance={allowanceValue}
              />
            ) : (
              <SendNativeToken amount={amount} receiverAddress={to} />
            )}

            {errorMsg && (
              <View style={[styles.error, { borderColor: colors.down }]}>
                <Text style={{ color: colors.down, fontSize: 16 }}>{errorMsg}</Text>
              </View>
            )}
            <View style={[styles.signingWith, { borderColor: colors.borderFourth }]}>
              <Text style={[styles.secondary, { color: colors.textSecondary }]}>{t('wc.dapp.tx.signingWith')}</Text>
            </View>

            <View style={[styles.flexWithRow, styles.sender]}>
              <View style={[styles.flexWithRow, styles.addressInfo, { alignItems: 'flex-start' }]}>
                <Image source={{ uri: toDataUrl(currentAddress?.hex) }} style={styles.avatar} />
                <View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.senderName, { color: colors.textPrimary }]}>{currentAccount?.nickname}</Text>
                    <Text style={[styles.smallText, { color: colors.textSecondary }]}>{shortenAddress(currentAddress?.hex)}</Text>
                  </View>

                  <View>
                    <Text>{t('tx.confirm.estimatedFee')}</Text>
                    <View style={[styles.flexWithRow, { marginTop: 8 }]}>
                      {currentNativeToken?.icon && <Icon source={currentNativeToken?.icon} width={24} height={24} />}
                      <Text style={[styles.gas, { color: colors.textPrimary }]}>{gasCost}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={styles.smallText}>{t('wc.sign.network', { network: currentNetwork?.name })}</Text>
            </View>
          </BottomSheetScrollView>
          <View style={[styles.flexWithRow, styles.buttons]}>
            <Button testID="reject" onPress={handleReject} style={styles.btn} loading={rejectLoading}>
              {t('common.cancel')}
            </Button>
            <Button testID="approve" style={styles.btn} onPress={handleApprove} loading={approveLoading}>
              {isContract ? t('common.confirm') : t('common.send')}
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {showEditAllowance && parseData && (
        <EditAllowance
          open={showEditAllowance}
          parseData={parseData}
          savedValue={allowanceValue}
          onSave={handleSaveEditAllowance}
          onClose={handleCloseEditAllowanceModel}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  flex1: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
  },

  secondary: {
    fontSize: 14,
    fontWeight: '300',
  },

  signingWith: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  smallText: {
    fontSize: 12,
    fontWeight: '300',
  },
  sender: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
  },
  gas: {
    fontSize: 16,
    fontWeight: '600',
  },
  flexWithRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressInfo: {
    gap: 8,
  },
  buttons: {
    gap: 16,
    marginTop: 22,
    marginBottom: 79,
  },
  btn: {
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  error: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 6,
    marginTop: 24,
  },
});

export default WalletConnectTransaction;

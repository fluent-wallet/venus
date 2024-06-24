import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { isNil } from 'lodash-es';
import { Interface } from '@ethersproject/abi';
import Decimal from 'decimal.js';
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
import { processError } from '@core/utils/eth';
import { fetchERC20AssetInfoBatchWithAccount } from '@core/WalletCore/Plugins/AssetsTracker/fetchers/basic';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import Events from '@core/WalletCore/Events';
import { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import { App } from '@core/database/models/App';
import { type IWCSendTransactionEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import { BSIMError } from '@WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import { AccountItemView } from '@modules/AccountsList';
import GasFeeSetting, { type GasEstimate } from '@modules/GasFee/GasFeeSetting';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import BottomSheet, { BottomSheetScrollView, snapPoints } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import { SignTransactionCancelError, useSignTransaction } from '@hooks/useSignTransaction';
import useInAsync from '@hooks/useInAsync';
import useFormatBalance from '@hooks/useFormatBalance';
import { ParseTxDataReturnType, isApproveMethod, parseTxData } from '@utils/parseTxData';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import { WalletConnectParamList, WalletConnectTransactionStackName } from '@router/configs';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import SendAsset from '@pages/SendTransaction/Step4Confirm/SendAsset';
import EditAllowance from './EditAllowance';
import SendContract from './Contract';

export type TxDataWithTokenInfo = ParseTxDataReturnType & {
  symbol?: string;
  balance?: string;
  decimals?: number;
};

function WalletConnectTransaction() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [showGasFeeSetting, setShowGasFeeSetting] = useState(false);
  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddressOfAccount(currentAccount?.id)!;
  const currentAddressValue = useCurrentAddressValue()!;
  const currentNetwork = useCurrentNetwork()!;
  const currentNativeAsset = useCurrentNetworkNativeAsset();

  const [errorMsg, setError] = useState('');
  const [parseData, setParseData] = useState<TxDataWithTokenInfo>();
  const [showEditAllowance, setShowEditAllowance] = useState(false);
  const [allowanceValue, setAllowanceValue] = useState('');

  const signTransaction = useSignTransaction();

  const epochHeightRef = useRef('');

  const navigation = useNavigation();
  const {
    params: {
      tx: { from, to, value, data, nonce, gasLimit, gasPrice, storageLimit, type, maxFeePerGas, maxPriorityFeePerGas },
      isContract,
      metadata,
    },
  } = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectTransactionStackName>>();

  const txData = useMemo(() => {
    if (allowanceValue && parseData?.functionName === 'approve' && isApproveMethod(parseData)) {
      const value = parseData.decimals ? new Decimal(allowanceValue).mul(new Decimal(10).pow(parseData.decimals)).toString() : allowanceValue;
      // is approve and allowance value is set , so we need to encode the date
      console.log(allowanceValue, parseData.decimals, value);
      const iface = new Interface([parseData.readableABI]);
      return iface.encodeFunctionData(parseData.functionName, [from, value]);
    }
    return data;
  }, [allowanceValue, data, from, parseData]);

  const txHalf = useMemo(
    () => ({
      to,
      value: value ? new Decimal(value.toString()).toHex() : '0x0',
      data: txData || '0x',
      from: currentAddressValue!,
      chainId: currentNetwork?.chainId,
    }),
    [txData, currentAddressValue, currentNetwork?.chainId, to, value],
  );

  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const dappCustomizeGasSetting = useMemo(
    () =>
      !isNil(gasPrice) || !isNil(maxFeePerGas) || !isNil(maxPriorityFeePerGas)
        ? {
            ...(gasPrice ? { suggestedGasPrice: gasPrice } : null),
            ...(maxFeePerGas ? { suggestedMaxFeePerGas: maxFeePerGas } : null),
            ...(maxPriorityFeePerGas ? { suggestedMaxPriorityFeePerGas: maxPriorityFeePerGas } : null),
          }
        : undefined,
    [gasPrice, maxFeePerGas, maxPriorityFeePerGas],
  );

  const dappCustomizeAdvanceSetting = useMemo(
    () =>
      !isNil(gasLimit) || !isNil(nonce) || !isNil(storageLimit)
        ? {
            ...(gasLimit ? { gasLimit } : null),
            ...(storageLimit ? { storageLimit } : null),
            ...(nonce ? { nonce: Number(nonce) } : null),
          }
        : undefined,
    [gasLimit, nonce, storageLimit],
  );

  const isSupport1559 = !!gasEstimate?.gasSetting?.suggestedMaxFeePerGas;
  const shouldUse1559 = isSupport1559 && (isNil(type) || (Number(type) !== 0 && Number(type) !== 1));

  const amount = useFormatBalance(String(value) || '0', currentNativeAsset?.decimals ?? 18);

  const _handleReject = useCallback(async () => {
    try {
      await plugins.WalletConnect.currentEventSubject.getValue()?.action.reject();
    } catch (e) {
      console.log(e);
    }
  }, []);

  const _handleApprove = useCallback(async () => {
    if (!gasEstimate) return;
    setError('');

    let txRaw!: string;
    let txHash!: string;
    let txError;
    let signatureRecord: Signature | undefined;
    let dapp: App | undefined;

    const tx = Object.assign({}, txHalf, {
      gasLimit: gasEstimate.advanceSetting?.gasLimit,
      ...(shouldUse1559
        ? {
            maxFeePerGas: gasEstimate.gasSetting.suggestedMaxFeePerGas,
            maxPriorityFeePerGas: gasEstimate.gasSetting.suggestedMaxPriorityFeePerGas,
            type: 2,
          }
        : {
            gasPrice: gasEstimate.gasSetting.suggestedGasPrice ?? gasEstimate.gasSetting.suggestedMaxFeePerGas,
            type: 0,
          }),
    }) as ITxEvm;

    const approve = plugins.WalletConnect.currentEventSubject.getValue()?.action.approve as IWCSendTransactionEvent['action']['approve'];
    try {
      tx.nonce = gasEstimate.advanceSetting?.nonce;

      if (currentNetwork.networkType === NetworkType.Conflux) {
        const currentEpochHeight = await plugins.BlockNumberTracker.getNetworkBlockNumber(currentNetwork);
        if (!epochHeightRef.current || !checkDiffInRange(BigInt(currentEpochHeight) - BigInt(epochHeightRef.current))) {
          epochHeightRef.current = currentEpochHeight;
        }
      }

      const { txRawPromise, cancel } = await signTransaction({ ...tx, epochHeight: epochHeightRef.current });

      txRaw = await txRawPromise;

      dapp = (await methods.queryAppByIdentity(metadata.url)) ?? undefined;
      signatureRecord = await methods.createSignature({
        address: currentAddress,
        signType: SignType.TX,
        app: dapp,
      });

      txHash = await plugins.Transaction.sendRawTransaction({ txRaw, network: currentNetwork });

      await approve(txHash);
    } catch (error: any) {
      if (error instanceof SignTransactionCancelError) {
        // ignore cancel error
        return;
      }

      const msg = matchRPCErrorMessage(error);
      txError = error;
      setError(msg);
      // TODO: show error
    } finally {
      if (txRaw) {
        Events.broadcastTransactionSubjectPush.next({
          txHash,
          txRaw,
          tx,
          address: currentAddress,
          signature: signatureRecord,
          app: dapp,
          extraParams: {
            assetType: isContract ? undefined : AssetType.Native,
            contractAddress: isContract ? to : undefined,
            to: to,
            sendAt: new Date(),
            epochHeight: currentNetwork.networkType === NetworkType.Conflux ? epochHeightRef.current : null,
            err: txError && String(txError.data || txError?.message || txError),
            errorType: txError ? processError(txError).errorType : undefined,
            method: parseData ? (parseData.functionName === 'unknown' ? 'Contract Interaction' : parseData.functionName) : 'transfer',
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAddressValue, currentNetwork?.id, gasLimit, gasPrice, to, navigation, value, gasEstimate, isContract, signTransaction, txData]);

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
      <BottomSheet isRoute snapPoints={snapPoints.large} style={{ flex: 1 }} onClose={() => handleReject()}>
        <BottomSheetScrollView>
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
            <>
              <Text style={[transactionConfirmStyle.sendTitle, styles.sendTitle, { color: colors.textPrimary }]}>{t('common.send')}</Text>
              <SendAsset amount={amount} symbol={currentNativeAsset?.symbol ?? 'CFX'} icon={currentNativeAsset?.icon} recipientAddress={to ?? ''} />
            </>
          )}

          {errorMsg && (
            <View style={[styles.error, { borderColor: colors.down }]}>
              <Text style={{ color: colors.down, fontSize: 16 }}>{errorMsg}</Text>
            </View>
          )}

          <View style={[transactionConfirmStyle.divider, { backgroundColor: colors.borderFourth }]} />

          <AccountItemView nickname={t('tx.confirm.signingWith')} addressValue={currentAddressValue} colors={colors}>
            <Text style={[transactionConfirmStyle.networkName, { color: colors.textSecondary }]} numberOfLines={1}>
              on {currentNetwork?.name}
            </Text>
          </AccountItemView>

          <Text style={[transactionConfirmStyle.estimateFee, { color: colors.textPrimary }]}>{t('tx.confirm.estimatedFee')}</Text>
          <EstimateFee
            gasSetting={gasEstimate?.gasSetting}
            advanceSetting={gasEstimate?.advanceSetting ?? gasEstimate?.estimateAdvanceSetting}
            onPressSettingIcon={() => setShowGasFeeSetting(true)}
          />
          <View style={[transactionConfirmStyle.btnArea, styles.btnArea]}>
            <Button testID="reject" style={transactionConfirmStyle.btn} loading={rejectLoading} size="small" onPress={handleReject}>
              {t('common.cancel')}
            </Button>
            <Button
              testID="approve"
              style={transactionConfirmStyle.btn}
              loading={approveLoading}
              size="small"
              onPress={handleApprove}
              disabled={isContract ? !parseData : false}
            >
              {isContract ? t('common.confirm') : t('common.send')}
            </Button>
          </View>
        </BottomSheetScrollView>
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
      <GasFeeSetting
        show={showGasFeeSetting}
        tx={txHalf}
        onClose={() => setShowGasFeeSetting(false)}
        onConfirm={setGasEstimate}
        dappCustomizeGasSetting={dappCustomizeGasSetting}
        dappCustomizeAdvanceSetting={dappCustomizeAdvanceSetting}
        force155={!isNil(type) && (Number(type) === 0 || Number(type) === 1)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  sendTitle: {
    marginTop: 0,
  },
  error: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 6,
    marginTop: 16,
    marginHorizontal: 16,
  },
  btnArea: {
    marginTop: 40,
    marginBottom: 32,
  },
});

export default WalletConnectTransaction;

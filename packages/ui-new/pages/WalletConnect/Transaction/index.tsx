import { BSIMError } from '@WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import { BSIMEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import MessageFail from '@assets/icons/message-fail.svg';
import BottomSheet, { BottomSheetScrollView, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import Events from '@core/WalletCore/Events';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { fetchERC20AssetInfoBatchWithAccount } from '@core/WalletCore/Plugins/AssetsTracker/fetchers/basic';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import {
  AssetSource,
  AssetType,
  NetworkType,
  VaultType,
  useCurrentAccount,
  useCurrentAddressOfAccount,
  useCurrentAddressValue,
  useCurrentNetwork,
  useCurrentNetworkNativeAsset,
  useVaultOfAccount,
} from '@core/WalletCore/Plugins/ReactInject';
import type { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import type { IWCSendTransactionEvent } from '@core/WalletCore/Plugins/WalletConnect/types';
import type { App } from '@core/database/models/App';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import { processError } from '@core/utils/eth';
import { Interface } from '@ethersproject/abi';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { SignTransactionCancelError, useSignTransaction } from '@hooks/useSignTransaction';
import { AccountItemView } from '@modules/AccountsList';
import GasFeeSetting, { type GasEstimate, type GasFeeSettingMethods } from '@modules/GasFee/GasFeeSetting';
import DappParamsWarning from '@modules/GasFee/GasFeeSetting/DappParamsWarning';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import BSIMVerify, { useBSIMVerify } from '@pages/SendTransaction/BSIMVerify';
import SendAsset from '@pages/SendTransaction/Step4Confirm/SendAsset';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import { type RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import type { WalletConnectParamList, WalletConnectTransactionStackName } from '@router/configs';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import { type ParseTxDataReturnType, isApproveMethod, parseTxData } from '@utils/parseTxData';
import { supportsInterface } from '@utils/supportsInterface';
import Decimal from 'decimal.js';
import { isNil, set } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import SendContract from './Contract';
import EditAllowance from './EditAllowance';

export type TxDataWithTokenInfo = ParseTxDataReturnType & {
  symbol?: string;
  balance?: string;
  decimals?: number;
  assetType?: AssetType;
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
  const currentVault = useVaultOfAccount(currentAccount?.id);

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
    if (allowanceValue && parseData && isApproveMethod(parseData) && parseData.assetType === AssetType.ERC20) {
      const value = parseData.decimals ? new Decimal(allowanceValue).mul(new Decimal(10).pow(parseData.decimals)).toString() : allowanceValue;
      // is approve and allowance value is set , so we need to encode the date

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

  const gasSettingMethods = useRef<GasFeeSettingMethods>(null!);
  const [showDappParamsWarning, setShowDappParamsWarning] = useState<boolean | null>(() => null);
  const checkDappParamsSuitable = useCallback(
    (_gasEstimate: GasEstimate) => {
      if (!_gasEstimate || showDappParamsWarning !== null) return;
      const isAdvanceSettingSuitable = dappCustomizeAdvanceSetting?.gasLimit
        ? new Decimal(dappCustomizeAdvanceSetting.gasLimit).greaterThanOrEqualTo(_gasEstimate.estimateAdvanceSetting.gasLimit)
        : true;

      const customizePrice = dappCustomizeGasSetting?.suggestedMaxFeePerGas ?? dappCustomizeGasSetting?.suggestedGasPrice;
      const isGasSettingSuitable = customizePrice ? new Decimal(customizePrice).greaterThanOrEqualTo(_gasEstimate.estimateCurrentGasPrice) : true;

      if (!isAdvanceSettingSuitable || !isGasSettingSuitable) {
        setShowDappParamsWarning(true);
      }
    },
    [dappCustomizeAdvanceSetting, dappCustomizeGasSetting, showDappParamsWarning],
  );

  const isSupport1559 = !!gasEstimate?.gasSetting?.suggestedMaxFeePerGas;
  const shouldUse1559 = isSupport1559 && (isNil(type) || (Number(type) !== 0 && Number(type) !== 1));

  const amount = useFormatBalance(value ? value.toString() : '0', currentNativeAsset?.decimals ?? 18);

  const _handleReject = useCallback(async () => {
    try {
      await plugins.WalletConnect.currentEventSubject.getValue()?.action.reject();
    } catch (e) {
      console.log(e);
    }
  }, []);

  const { bsimEvent, setBSIMEvent, execBSIMCancel, setBSIMCancel } = useBSIMVerify();
  const _handleApprove = useCallback(async () => {
    if (!gasEstimate) return;
    setError('');
    setBSIMEvent(null);
    execBSIMCancel();

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
    tx.nonce = gasEstimate.advanceSetting?.nonce;

    const approve = plugins.WalletConnect.currentEventSubject.getValue()?.action.approve as IWCSendTransactionEvent['action']['approve'];
    try {
      if (currentNetwork.networkType === NetworkType.Conflux) {
        const currentEpochHeight = await plugins.BlockNumberTracker.getNetworkBlockNumber(currentNetwork);
        if (!epochHeightRef.current || !checkDiffInRange(BigInt(currentEpochHeight) - BigInt(epochHeightRef.current))) {
          epochHeightRef.current = currentEpochHeight;
        }
      }

      if (currentVault?.type === VaultType.BSIM) {
        setBSIMEvent({ type: BSIMEventTypesName.BSIM_SIGN_START });
      }

      const { txRawPromise, cancel } = await signTransaction({ ...tx, epochHeight: epochHeightRef.current });
      setBSIMCancel(cancel);
      txRaw = await txRawPromise;
      dapp = (await methods.queryAppByIdentity(metadata.url)) ?? undefined;
      signatureRecord = await methods.createSignature({
        address: currentAddress,
        signType: SignType.TX,
        app: dapp,
      });

      txHash = await plugins.Transaction.sendRawTransaction({ txRaw, network: currentNetwork });

      await approve(txHash);
      setBSIMEvent(null);
    } catch (error: any) {
      if (error instanceof BSIMError) {
        setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: error?.message });
        return;
      }
      setBSIMEvent(null);

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
            assetType: isContract ? parseData?.assetType : AssetType.Native,
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
  }, [currentAddressValue, currentNetwork?.id, gasLimit, gasPrice, to, navigation, value, gasEstimate, isContract, signTransaction, txData, parseData]);

  useEffect(() => {
    async function parseAndTryGetTokenInfo() {
      if (isContract) {
        const parseData = parseTxData({ data, to });

        if (to) {
          const typeByInterface = await supportsInterface(to, {
            networkType: currentNetwork.networkType,
            endpoint: currentNetwork?.endpoint,
          });

          const remoteAsset = await fetchERC20AssetInfoBatchWithAccount({
            networkType: currentNetwork.networkType,
            endpoint: currentNetwork?.endpoint,
            contractAddress: to,
            accountAddress: currentAddress!,
          });
          const assertType =
            typeByInterface !== 'Unknown' ? typeByInterface : remoteAsset.decimals && remoteAsset.name && remoteAsset.symbol ? AssetType.ERC20 : 'Unknown';

          setParseData({
            ...parseData,
            symbol: remoteAsset.symbol,
            balance: remoteAsset.balance,
            decimals: remoteAsset.decimals,
            assetType: assertType === 'Unknown' ? undefined : assertType,
          });

          if (assertType === 'Unknown') return;

          const assetInfo = { ...remoteAsset, type: assertType, contractAddress: to };

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
              <MessageFail color={colors.down} width={24} height={24} />
              <Text style={{ color: colors.down, fontSize: 16 }}>{errorMsg}</Text>
            </View>
          )}

          <View style={[transactionConfirmStyle.divider, { backgroundColor: colors.borderFourth }]} />

          <Text style={[transactionConfirmStyle.signWith, { color: colors.textSecondary }]}>{t('tx.confirm.signingWith')}</Text>
          <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAddressValue} colors={colors}>
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
        </BottomSheetScrollView>
        <View style={[transactionConfirmStyle.btnArea, styles.btnArea]}>
          <Button testID="reject" style={transactionConfirmStyle.btn} loading={rejectLoading} size="small" onPress={handleReject}>
            {t('common.cancel')}
          </Button>
          <Button
            testID="approve"
            style={transactionConfirmStyle.btn}
            loading={approveLoading}
            size="small"
            onPress={_handleApprove}
            disabled={isContract ? !parseData : false}
          >
            {isContract ? t('common.confirm') : t('common.send')}
          </Button>
        </View>
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
        ref={gasSettingMethods}
        show={showGasFeeSetting}
        tx={txHalf}
        onClose={() => setShowGasFeeSetting(false)}
        onConfirm={(newGasEstimate) => {
          setGasEstimate(newGasEstimate);
          checkDappParamsSuitable(newGasEstimate);
        }}
        dappCustomizeGasSetting={dappCustomizeGasSetting}
        dappCustomizeAdvanceSetting={dappCustomizeAdvanceSetting}
        force155={!isNil(type) && (Number(type) === 0 || Number(type) === 1)}
      />
      {bsimEvent && (
        <BSIMVerify
          bsimEvent={bsimEvent}
          onClose={() => {
            setBSIMEvent(null);
            execBSIMCancel();
          }}
          onRetry={handleApprove}
        />
      )}
      {showDappParamsWarning && (
        <DappParamsWarning onClose={() => setShowDappParamsWarning(false)} onPressUse={() => gasSettingMethods.current?.resetCustomizeSetting?.()} />
      )}
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
    display: 'flex',
    flexDirection: 'row',
  },
  btnArea: {
    marginTop: 'auto',
    marginBottom: 100,
  },
});

export default WalletConnectTransaction;

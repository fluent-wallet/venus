import MessageFail from '@assets/icons/message-fail.svg';
import { BottomSheetFooter, BottomSheetHeader, BottomSheetRoute, BottomSheetScrollContent, BottomSheetWrapper, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { BSIM_ERROR_CANCEL } from '@core/hardware/bsim/constants';
import { type EvmRpcTransactionRequest, parseEvmRpcTransactionRequest } from '@core/services/transaction';
import { ASSET_TYPE, AssetType, type Hex } from '@core/types';
import { Interface } from '@ethersproject/abi';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import GasFeeSetting, { type GasEstimate, type GasFeeSettingMethods } from '@modules/GasFee/GasFeeSetting';
import DappParamsWarning from '@modules/GasFee/GasFeeSetting/DappParamsWarning';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import BSIMVerify, { BSIMEventTypesName, useBSIMVerify } from '@pages/SendTransaction/BSIMVerify';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import SendAsset from '@pages/SendTransaction/Step4Confirm/SendAsset';
import { type RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import type { StackNavigation, WalletConnectParamList, WalletConnectTransactionStackName } from '@router/configs';
import { useCurrentAccount, useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { getAddressValidationService, getAssetService, getExternalRequestsService, getTransactionService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import { isApproveMethod, type ParseTxDataReturnType, parseTxDataAsync } from '@utils/parseTxData';
import { supportsInterface } from '@utils/supportsInterface';
import Decimal from 'decimal.js';
import { isNil } from 'lodash-es';
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

const toHexQuantity = (value: number): `0x${string}` => `0x${Math.max(0, Math.trunc(value)).toString(16)}`;
const isBsimHardwareError = (error: unknown): error is { code: string; message: string } => {
  return Boolean(
    error && typeof error === 'object' && (error as { name?: unknown }).name === 'BSIMHardwareError' && typeof (error as { code?: unknown }).code === 'string',
  );
};

function WalletConnectTransaction() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rootNavigation = useNavigation<StackNavigation>();
  const [showGasFeeSetting, setShowGasFeeSetting] = useState(false);
  const { data: currentAccount } = useCurrentAccount();
  const { data: currentAddress } = useCurrentAddress();
  const { data: currentNetwork } = useCurrentNetwork();
  const { data: assets } = useAssetsOfCurrentAddress();
  const nativeAsset = useMemo(() => assets?.find((a) => a.type === ASSET_TYPE.Native) ?? null, [assets]);

  const [errorMsg, setError] = useState('');
  const [parseData, setParseData] = useState<TxDataWithTokenInfo>();
  const [showEditAllowance, setShowEditAllowance] = useState(false);
  const [allowanceValue, setAllowanceValue] = useState('');

  const navigation = useNavigation<StackNavigation>();
  const route = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectTransactionStackName>>();
  const params = route.params as WalletConnectParamList[typeof WalletConnectTransactionStackName];

  const { requestId, request, isContract: isContractParam } = params;

  const metadata = request?.metadata ?? { url: '', name: '', icons: [] };

  const rpcTx = useMemo(() => {
    try {
      return parseEvmRpcTransactionRequest(request?.params);
    } catch {
      return null;
    }
  }, [request?.params]);

  const from = rpcTx?.from;
  const to = rpcTx?.to;
  const value = rpcTx?.value;
  const data = rpcTx?.data;
  const nonce = rpcTx?.nonce;
  const gas = rpcTx?.gas;
  const gasPrice = rpcTx?.gasPrice;
  const type = rpcTx?.type;
  const maxFeePerGas = rpcTx?.maxFeePerGas;
  const maxPriorityFeePerGas = rpcTx?.maxPriorityFeePerGas;

  const [isContract, setIsContract] = useState<boolean>(() => (typeof isContractParam === 'boolean' ? isContractParam : false));

  useEffect(() => {
    if (typeof isContractParam === 'boolean') return;
    if (!currentNetwork) return;
    if (!rpcTx) return;

    if (!rpcTx.to) {
      setIsContract(true);
      return;
    }

    getAddressValidationService()
      .isContractAddress({ networkType: currentNetwork.networkType, chainId: currentNetwork.chainId, addressValue: rpcTx.to })
      .then((res) => {
        const contract = Boolean(res);
        const EOATx = (!contract && !!rpcTx.to) || !rpcTx.data || rpcTx.data === '0x';
        setIsContract(!EOATx);
      })
      .catch(() => setIsContract(false));
  }, [currentNetwork, isContractParam, rpcTx]);

  const txData = useMemo(() => {
    if (allowanceValue && parseData && isApproveMethod(parseData) && parseData.assetType === AssetType.ERC20) {
      const value = parseData.decimals ? new Decimal(allowanceValue).mul(new Decimal(10).pow(parseData.decimals)).toFixed(0) : allowanceValue;
      // is approve and allowance value is set , so we need to encode the date

      const iface = new Interface([parseData.readableABI]);
      return iface.encodeFunctionData(parseData.functionName, [parseData.address, value]);
    }
    return data;
  }, [allowanceValue, data, parseData]);

  const txHalf = useMemo(
    () => ({
      to,
      value: value ?? '0x0',
      data: txData || '0x',
      from: currentAccount?.address,
      chainId: currentNetwork?.chainId,
    }),
    [currentAccount?.address, currentNetwork?.chainId, to, txData, value],
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
      !isNil(gas) || !isNil(nonce)
        ? {
            ...(gas ? { gas } : null),
            ...(nonce ? { nonce: Number(nonce) } : null),
          }
        : undefined,
    [gas, nonce],
  );

  const gasSettingMethods = useRef<GasFeeSettingMethods>(null!);
  const [showDappParamsWarning, setShowDappParamsWarning] = useState<boolean | null>(() => null);
  const checkDappParamsSuitable = useCallback(
    (_gasEstimate: GasEstimate) => {
      if (!_gasEstimate || showDappParamsWarning !== null) return;
      const isAdvanceSettingSuitable = dappCustomizeAdvanceSetting?.gas
        ? new Decimal(dappCustomizeAdvanceSetting.gas).greaterThanOrEqualTo(_gasEstimate.estimateAdvanceSetting.gasLimit)
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

  const amount = useFormatBalance(value ? value.toString() : '0', nativeAsset?.decimals ?? 18);

  const _handleReject = useCallback(async () => {
    try {
      try {
        signingAbortRef.current?.abort();
      } catch {
        // ignore
      }

      try {
        getExternalRequestsService().reject({ requestId });
      } catch (error) {
        console.log(error);
      } finally {
        if (navigation.canGoBack()) navigation.goBack();
      }
    } catch (e) {
      console.log(e);
    }
  }, [navigation, requestId]);

  const { bsimEvent, setBSIMEvent, execBSIMCancel, setBSIMCancel } = useBSIMVerify();
  const signingAbortRef = useRef<AbortController | null>(null);
  const _handleApprove = useCallback(async () => {
    if (!gasEstimate) return;
    if (!currentAddress?.id || !currentAccount?.address) return;
    if (!requestId) return;
    if (!rpcTx) return;

    setError('');
    setBSIMEvent(null);
    execBSIMCancel();

    try {
      signingAbortRef.current = new AbortController();
      setBSIMCancel(() => signingAbortRef.current?.abort());

      if (currentAccount.isHardwareWallet) {
        setBSIMEvent({ type: BSIMEventTypesName.BSIM_SIGN_START });
      }

      const gasPriceOrMaxFee = gasEstimate.gasSetting.suggestedGasPrice ?? gasEstimate.gasSetting.suggestedMaxFeePerGas;
      const requestForSend: EvmRpcTransactionRequest = {
        from: currentAccount.address,
        to: rpcTx.to,
        value: rpcTx.value ?? '0x0',
        data: txData || '0x',
        gas: gasEstimate.advanceSetting?.gasLimit,
        nonce: gasEstimate.advanceSetting?.nonce != null ? (toHexQuantity(gasEstimate.advanceSetting.nonce) as unknown as Hex) : undefined,
        ...(shouldUse1559
          ? {
              maxFeePerGas: gasEstimate.gasSetting.suggestedMaxFeePerGas,
              maxPriorityFeePerGas: gasEstimate.gasSetting.suggestedMaxPriorityFeePerGas,
              type: '0x2' as Hex,
            }
          : {
              gasPrice: gasPriceOrMaxFee,
              type: '0x0' as Hex,
            }),
      };

      const appIdentity = typeof metadata.url === 'string' ? metadata.url : '';
      const app = appIdentity
        ? {
            identity: appIdentity,
            origin: appIdentity,
            name: metadata.name || appIdentity,
            icon: Array.isArray(metadata.icons) ? metadata.icons[0] : undefined,
          }
        : null;

      const tx = await getTransactionService().sendDappTransaction({
        addressId: currentAddress.id,
        request: requestForSend,
        app,
        signal: signingAbortRef.current.signal,
      });

      try {
        getExternalRequestsService().approve({ requestId, data: { result: tx.hash } });
      } catch (error) {
        console.log(error);
      } finally {
        setBSIMEvent(null);
        if (navigation.canGoBack()) navigation.goBack();
      }
    } catch (error: any) {
      if (
        handleBSIMHardwareUnavailable(error, rootNavigation, {
          beforeNavigate: () => setBSIMEvent(null),
        })
      ) {
        return;
      }
      if (error && typeof error === 'object' && (error as { code?: unknown }).code === BSIM_ERROR_CANCEL) {
        return;
      }

      if (currentAccount?.isHardwareWallet && isBsimHardwareError(error)) {
        setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: error.message });
        return;
      }

      const msg = matchRPCErrorMessage(error);
      setError(msg);
      // TODO: show error
      setBSIMEvent(null);
    }
  }, [
    currentAccount?.address,
    currentAccount?.isHardwareWallet,
    currentAddress?.id,
    gasEstimate,
    gasEstimate,
    metadata.icons,
    metadata.name,
    metadata.url,
    navigation,
    txData,
    requestId,
    rootNavigation,
    rpcTx,
    setBSIMCancel,
    setBSIMEvent,
    execBSIMCancel,
    shouldUse1559,
  ]);

  useEffect(() => {
    async function parseAndTryGetTokenInfo() {
      if (!currentNetwork) return;
      if (!currentAddress?.id) return;
      if (!rpcTx) return;
      if (!isContract) return;

      const parsed = await parseTxDataAsync({ data, to, netId: currentNetwork.netId });

      if (to) {
        const [typeByInterface, tokenInfo] = await Promise.all([
          supportsInterface(to, {
            networkType: currentNetwork.networkType as any,
            endpoint: currentNetwork.endpoint,
          }),
          getAssetService().getErc20TokenInfo({ addressId: currentAddress.id, contractAddress: to }),
        ]);

        const assertType =
          typeByInterface !== 'Unknown'
            ? (typeByInterface as unknown as AssetType)
            : tokenInfo.decimals && tokenInfo.name && tokenInfo.symbol
              ? AssetType.ERC20
              : 'Unknown';

        setParseData({
          ...parsed,
          symbol: tokenInfo.symbol ?? undefined,
          balance: tokenInfo.balance,
          decimals: tokenInfo.decimals,
          assetType: assertType === 'Unknown' ? undefined : assertType,
        });

        if (assertType === AssetType.ERC20) {
          try {
            await getAssetService().addCustomToken({
              addressId: currentAddress.id,
              contractAddress: to,
              name: tokenInfo.name ?? undefined,
              symbol: tokenInfo.symbol ?? undefined,
              decimals: tokenInfo.decimals,
            });
          } catch {
            // ignore
          }
        }
      } else {
        setParseData(parsed);
      }
    }
    parseAndTryGetTokenInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, to, isContract, currentNetwork?.id, currentAddress?.id, currentNetwork?.netId, rpcTx]);

  const handleOpenEditAllowanceModel = useCallback(() => {
    if (parseData?.functionName === 'approve' && parseData?.assetType === AssetType.ERC20) {
      setShowEditAllowance(true);
    }
  }, [setShowEditAllowance, parseData]);

  const handleSaveEditAllowance = useCallback((value: string) => {
    setAllowanceValue(value);
  }, []);

  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);

  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);

  return (
    <>
      <BottomSheetRoute
        enablePanDownToClose={!approveLoading}
        enableContentPanningGesture={!approveLoading}
        snapPoints={snapPoints.large}
        onClose={handleReject}
      >
        <BottomSheetWrapper>
          <BottomSheetHeader title={t('wc.dapp.tx.title')} />
          <BottomSheetScrollContent>
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
                <SendAsset amount={amount} symbol={nativeAsset?.symbol ?? 'CFX'} icon={nativeAsset?.icon} recipientAddress={to ?? ''} />
              </>
            )}

            {errorMsg && (
              <View style={[styles.error, { borderColor: colors.down }]}>
                <MessageFail color={colors.down} width={24} height={24} />
                <Text style={{ color: colors.down, fontSize: 16, flexShrink: 1 }}>{errorMsg}</Text>
              </View>
            )}
          </BottomSheetScrollContent>
        </BottomSheetWrapper>
        <BottomSheetFooter>
          <View style={[transactionConfirmStyle.divider, { backgroundColor: colors.borderFourth }]} />

          <Text style={[transactionConfirmStyle.signWith, { color: colors.textSecondary }]}>{t('tx.confirm.signingWith')}</Text>
          <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAccount?.address ?? ''} colors={colors}>
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
        </BottomSheetFooter>
      </BottomSheetRoute>

      {!!(showEditAllowance && parseData) && (
        <EditAllowance
          isOpen={!!(showEditAllowance && parseData)}
          parseData={parseData}
          savedValue={allowanceValue}
          onSave={handleSaveEditAllowance}
          onClose={() => setShowEditAllowance(false)}
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

      {!!showDappParamsWarning && (
        <DappParamsWarning
          isOpen={!!showDappParamsWarning}
          onClose={() => setShowDappParamsWarning(false)}
          onPressUse={() => gasSettingMethods.current?.resetCustomizeSetting?.()}
        />
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
    marginTop: 40,
  },
});

export default WalletConnectTransaction;

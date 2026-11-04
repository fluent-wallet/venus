import MessageFail from '@assets/icons/message-fail.svg';
import Button from '@components/Button';
import { SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { BSIM_ERROR_CANCEL } from '@core/hardware/bsim/constants';
import { type EvmRpcTransactionRequest, parseEvmRpcTransactionRequest } from '@core/services/transaction';
import { ASSET_TYPE, type AssetTypeValue, type Hex } from '@core/types';
import { isApproveMethod, type ParseTxDataReturnType } from '@core/utils/txData';
import { Interface } from '@ethersproject/abi';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import GasFeeSetting, { type GasEstimate, type GasFeeSettingMethods } from '@modules/GasFee/GasFeeSetting';
import DappParamsWarning from '@modules/GasFee/GasFeeSetting/DappParamsWarning';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import { getGasSettingPrimaryFee, isEip1559GasSetting } from '@modules/GasFee/GasFeeSetting/gasSetting';
import HardwareSignVerify from '@pages/SendTransaction/HardwareSignVerify';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import SendAsset from '@pages/SendTransaction/Step4Confirm/SendAsset';
import { useHardwareSigningUiState } from '@pages/SendTransaction/Step4Confirm/useHardwareSigningUiState';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import type { StackScreenProps, WalletConnectTransactionStackName } from '@router/configs';
import { useCurrentAccount, useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { getAssetService, getExternalRequestsService, getTransactionService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import Decimal from 'decimal.js';
import { isNil } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import SendContract from './Contract';
import EditAllowance from './EditAllowance';

export type TxDataWithTokenInfo = ParseTxDataReturnType & {
  symbol?: string;
  balance?: string;
  decimals?: number;
  assetType?: AssetTypeValue;
};

const toHexQuantity = (value: number): `0x${string}` => `0x${Math.max(0, Math.trunc(value)).toString(16)}`;
const isBsimHardwareError = (error: unknown): error is { code: string; message: string } => {
  return Boolean(
    error && typeof error === 'object' && (error as { name?: unknown }).name === 'BSIMHardwareError' && typeof (error as { code?: unknown }).code === 'string',
  );
};

const isUserCanceledError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === AUTH_PASSWORD_REQUEST_CANCELED) return true;
  if (code === BSIM_ERROR_CANCEL) return true;

  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'AbortError') return true;

  return false;
};

function WalletConnectTransaction({ navigation, route }: StackScreenProps<typeof WalletConnectTransactionStackName>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
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

  const { requestId, request, isContract } = route.params;

  const metadata = request?.metadata ?? { url: '', name: '', icons: [] };

  const rpcTx = useMemo(() => {
    try {
      return parseEvmRpcTransactionRequest(request?.params);
    } catch {
      return null;
    }
  }, [request?.params]);

  const to = rpcTx?.to;
  const value = rpcTx?.value;
  const data = rpcTx?.data;
  const nonce = rpcTx?.nonce;
  const gas = rpcTx?.gas;
  const gasPrice = rpcTx?.gasPrice;
  const type = rpcTx?.type;
  const maxFeePerGas = rpcTx?.maxFeePerGas;
  const maxPriorityFeePerGas = rpcTx?.maxPriorityFeePerGas;

  const txData = useMemo(() => {
    if (allowanceValue && parseData && isApproveMethod(parseData) && parseData.assetType === ASSET_TYPE.ERC20) {
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

  const gasSettingMethods = useRef<GasFeeSettingMethods | null>(null);
  const [showDappParamsWarning, setShowDappParamsWarning] = useState<boolean | null>(() => null);
  const abortRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const isClosedRef = useRef(false);
  const requestSettledRef = useRef(false);
  const addressId = currentAddress?.id ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);
  const checkDappParamsSuitable = useCallback(
    (_gasEstimate: GasEstimate) => {
      if (!_gasEstimate || showDappParamsWarning !== null) return;
      const isAdvanceSettingSuitable = dappCustomizeAdvanceSetting?.gas
        ? new Decimal(dappCustomizeAdvanceSetting.gas).greaterThanOrEqualTo(_gasEstimate.estimateAdvanceSetting.gasLimit)
        : true;

      const customizePrice = getGasSettingPrimaryFee(dappCustomizeGasSetting);
      const isGasSettingSuitable = customizePrice ? new Decimal(customizePrice).greaterThanOrEqualTo(_gasEstimate.estimateCurrentGasPrice) : true;

      if (!isAdvanceSettingSuitable || !isGasSettingSuitable) {
        setShowDappParamsWarning(true);
      }
    },
    [dappCustomizeAdvanceSetting, dappCustomizeGasSetting, showDappParamsWarning],
  );

  const isSupport1559 = !!gasEstimate?.gasSetting && isEip1559GasSetting(gasEstimate.gasSetting);
  const shouldUse1559 = isSupport1559 && (isNil(type) || (Number(type) !== 0 && Number(type) !== 1));

  const amount = useFormatBalance(value ? value.toString() : '0', nativeAsset?.decimals ?? 18);

  const _handleReject = useCallback(async () => {
    if (submittingRef.current) return;
    navigation.goBack();
  }, [navigation]);

  useEffect(
    () => () => {
      isClosedRef.current = true;
      // Once Send starts, the submission owns the response even if this screen leaves.
      if (submittingRef.current || requestSettledRef.current) return;
      requestSettledRef.current = true;
      try {
        getExternalRequestsService().reject({ requestId });
      } catch (error) {
        console.log(error);
      }
    },
    [requestId],
  );

  useFocusEffect(
    useCallback(() => {
      // A completed transaction must not become another Send when a covering route closes.
      if (requestSettledRef.current && navigation.isFocused()) navigation.goBack();
    }, [navigation]),
  );

  const finalizeApprove = useCallback(
    (result: string) => {
      requestSettledRef.current = true;
      if (!isClosedRef.current) {
        clearHardwareSignState();
        if (navigation.isFocused()) navigation.goBack();
      }
      try {
        getExternalRequestsService().approve({ requestId, data: { result } });
      } catch (error) {
        showMessage({ message: matchRPCErrorMessage(error as { message?: string; data?: string; code?: number }), type: 'danger' });
      }
    },
    [clearHardwareSignState, navigation, requestId],
  );

  const _handleApprove = useCallback(async () => {
    if (!gasEstimate) return;
    if (!currentAddress?.id || !currentAccount?.address) return;
    if (!requestId) return;
    if (!rpcTx) return;
    if (submittingRef.current || requestSettledRef.current) return;

    submittingRef.current = true;
    setError('');
    const controller = currentAccount.isHardwareWallet ? new AbortController() : null;
    abortRef.current = controller;
    clearHardwareSignState();

    try {
      const gasPriceOrMaxFee = getGasSettingPrimaryFee(gasEstimate.gasSetting);
      const requestForSend: EvmRpcTransactionRequest = {
        from: currentAccount.address,
        to: rpcTx.to,
        value: rpcTx.value ?? '0x0',
        data: txData || '0x',
        gas: gasEstimate.advanceSetting?.gasLimit,
        nonce: gasEstimate.advanceSetting?.nonce != null ? (toHexQuantity(gasEstimate.advanceSetting.nonce) as unknown as Hex) : undefined,
        ...(shouldUse1559 && isEip1559GasSetting(gasEstimate.gasSetting)
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
        signal: controller?.signal,
      });

      finalizeApprove(tx.hash);
    } catch (error: unknown) {
      if (isClosedRef.current) {
        requestSettledRef.current = true;
        try {
          getExternalRequestsService().reject({ requestId, error });
        } catch (rejectError) {
          console.log(rejectError);
        }
        return;
      }

      if (
        handleBSIMHardwareUnavailable(error, navigation, {
          beforeNavigate: () => {
            clearHardwareSignState();
            abortRef.current?.abort();
          },
        })
      ) {
        return;
      }

      if (controller?.signal.aborted || isUserCanceledError(error)) {
        clearHardwareSignState();
        return;
      }

      if (currentAccount?.isHardwareWallet && isBsimHardwareError(error)) {
        setError(error.message);
        return;
      }

      const msg = matchRPCErrorMessage(error);
      setError(msg);
      clearHardwareSignState();
    } finally {
      submittingRef.current = false;
      abortRef.current = null;
    }
  }, [
    clearHardwareSignState,
    currentAccount?.address,
    currentAccount?.isHardwareWallet,
    currentAddress?.id,
    gasEstimate,
    metadata.icons,
    metadata.name,
    metadata.url,
    navigation,
    txData,
    requestId,
    rpcTx,
    shouldUse1559,
    finalizeApprove,
  ]);

  useEffect(() => {
    async function parseAndTryGetTokenInfo() {
      if (!currentAddress?.id) return;
      if (!rpcTx) return;
      if (!isContract) return;

      const parsed = await getTransactionService().decodeContractData({
        addressId: currentAddress.id,
        data,
        to,
      });

      if (to) {
        const inspection = await getAssetService().inspectContractAsset({ addressId: currentAddress.id, contractAddress: to });
        const assetType = inspection.assetType ?? undefined;

        setParseData({
          ...parsed,
          symbol: inspection.symbol ?? undefined,
          balance: inspection.balance ?? undefined,
          decimals: inspection.decimals ?? undefined,
          assetType,
        });

        if (assetType === ASSET_TYPE.ERC20) {
          try {
            await getAssetService().addCustomToken({
              addressId: currentAddress.id,
              contractAddress: to,
              name: inspection.name ?? undefined,
              symbol: inspection.symbol ?? undefined,
              decimals: inspection.decimals ?? undefined,
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
  }, [data, to, isContract, currentAddress?.id, rpcTx]);

  const handleOpenEditAllowanceModel = useCallback(() => {
    if (parseData?.functionName === 'approve' && parseData?.assetType === ASSET_TYPE.ERC20) {
      setShowEditAllowance(true);
    }
  }, [parseData]);

  const handleSaveEditAllowance = useCallback((value: string) => {
    setAllowanceValue(value);
  }, []);

  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);

  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);

  return (
    <View style={styles.container} collapsable={false}>
      <SheetHeader title={t('wc.dapp.tx.title')} />
      <SheetScrollView>
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

        {parseData && (
          <EditAllowance
            isOpen={showEditAllowance}
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
        <HardwareSignVerify
          state={currentAccount?.isHardwareWallet ? hardwareSignState : null}
          onClose={() => {
            abortRef.current?.abort();
            clearHardwareSignState();
          }}
          onRetry={handleApprove}
        />

        <DappParamsWarning
          isOpen={!!showDappParamsWarning}
          onClose={() => setShowDappParamsWarning(false)}
          onPressUse={() => gasSettingMethods.current?.resetCustomizeSetting?.()}
        />
      </SheetScrollView>
      <SheetFooter style={styles.footer}>
        <View style={[transactionConfirmStyle.divider, { backgroundColor: colors.borderFourth }]} />

        <Text style={[transactionConfirmStyle.signWith, { color: colors.textSecondary }]}>{t('tx.confirm.signingWith')}</Text>
        <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAccount?.address ?? ''}>
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
          <Button testID="reject" style={transactionConfirmStyle.btn} loading={rejectLoading} size="small" onPress={handleReject} disabled={approveLoading}>
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
      </SheetFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 0,
  },
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

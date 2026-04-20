import MessageFail from '@assets/icons/message-fail.svg';
import { BottomSheetFooter, BottomSheetHeader, BottomSheetRoute, BottomSheetScrollContent, BottomSheetWrapper, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { BSIM_ERROR_CANCEL } from '@core/hardware/bsim/constants';
import type { FeeFields, FeeSelection, ReviewFee, TransactionQuotePresetOption } from '@core/services/transaction';
import { type EvmRpcTransactionRequest, parseEvmRpcTransactionRequest } from '@core/services/transaction';
import { ASSET_TYPE, type AssetTypeValue, type Hex } from '@core/types';
import { isApproveMethod, type ParseTxDataReturnType } from '@core/utils/txData';
import { Interface } from '@ethersproject/abi';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import GasFeeSetting, { type AdvanceSetting } from '@modules/GasFee/GasFeeSetting';
import DappParamsWarning from '@modules/GasFee/GasFeeSetting/DappParamsWarning';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import { getGasSettingPrimaryFee, isEip1559GasSetting, resolveGasSettingWithLevel } from '@modules/GasFee/GasFeeSetting/gasSetting';
import HardwareSignVerify from '@pages/SendTransaction/HardwareSignVerify';
import { styles as transactionConfirmStyle } from '@pages/SendTransaction/Step4Confirm/index';
import SendAsset from '@pages/SendTransaction/Step4Confirm/SendAsset';
import { useHardwareSigningUiState } from '@pages/SendTransaction/Step4Confirm/useHardwareSigningUiState';
import { type RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import type { StackNavigation, WalletConnectParamList, WalletConnectTransactionStackName } from '@router/configs';
import { useCurrentAccount, useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { getAssetService, getExternalRequestsService, getTransactionService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { type ITransactionGasEstimate, type Level, usePollingGasEstimateAndNonce } from '@service/transaction';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
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
  assetType?: AssetTypeValue;
};

const quoteLevels: readonly Level[] = ['low', 'medium', 'high'];

const toHexQuantity = (value: number): `0x${string}` => `0x${Math.max(0, Math.trunc(value)).toString(16)}`;
const isEip1559TransactionGasLevel = (
  level: ITransactionGasEstimate['levels'][Level],
): level is Extract<ITransactionGasEstimate['levels'][Level], { suggestedMaxFeePerGas: string; suggestedMaxPriorityFeePerGas: string }> => {
  return 'suggestedMaxFeePerGas' in level;
};
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

const buildPresetOptionsFromEstimate = (estimate: ITransactionGasEstimate | null): readonly TransactionQuotePresetOption[] => {
  if (!estimate) {
    return [];
  }

  return quoteLevels.map((presetId) => {
    const level = estimate.levels[presetId];

    if ('suggestedGasPrice' in level) {
      return {
        presetId,
        fee: {
          gasPrice: level.suggestedGasPrice,
        },
        gasCost: level.gasCost as Hex,
      };
    }

    return {
      presetId,
      fee: {
        maxFeePerGas: level.suggestedMaxFeePerGas,
        maxPriorityFeePerGas: level.suggestedMaxPriorityFeePerGas,
      },
      gasCost: level.gasCost as Hex,
    };
  });
};

const buildRequestedFeeFields = (params: { request: EvmRpcTransactionRequest | null; estimate: ITransactionGasEstimate | null }): FeeFields | null => {
  const { request, estimate } = params;
  if (!request) {
    return null;
  }

  const requestType = request.type != null ? Number(request.type) : undefined;

  const build1559FeeFields = (): FeeFields | null => {
    const estimatedMediumLevel = estimate?.pricingKind === 'eip1559' && isEip1559TransactionGasLevel(estimate.levels.medium) ? estimate.levels.medium : null;
    const estimatedMaxFeePerGas = estimatedMediumLevel ? estimatedMediumLevel.suggestedMaxFeePerGas : undefined;
    const estimatedMaxPriorityFeePerGas = estimatedMediumLevel ? estimatedMediumLevel.suggestedMaxPriorityFeePerGas : undefined;
    const maxFeePerGas = request.maxFeePerGas ?? estimatedMaxFeePerGas;
    const maxPriorityFeePerGas = request.maxPriorityFeePerGas ?? estimatedMaxPriorityFeePerGas;

    if (typeof maxFeePerGas !== 'string' || typeof maxPriorityFeePerGas !== 'string') {
      return null;
    }

    return {
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  };

  if (requestType === 0 || requestType === 1) {
    return typeof request.gasPrice === 'string' ? { gasPrice: request.gasPrice } : null;
  }

  if (requestType === 2) {
    return build1559FeeFields();
  }

  if (typeof request.maxFeePerGas === 'string' || typeof request.maxPriorityFeePerGas === 'string') {
    return build1559FeeFields();
  }

  if (typeof request.gasPrice === 'string') {
    return {
      gasPrice: request.gasPrice,
    };
  }

  return null;
};

const pickFeeFields = (selection: FeeSelection, presetOptions: readonly TransactionQuotePresetOption[]): FeeFields | null => {
  if (selection.kind === 'custom') {
    return selection.fee;
  }

  return presetOptions.find((option) => option.presetId === selection.presetId)?.fee ?? null;
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

  const { requestId, request, isContract } = params;

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
  const estimateQuote = usePollingGasEstimateAndNonce(txHalf, true, currentAddress?.id);
  const presetOptions = useMemo(() => buildPresetOptionsFromEstimate(estimateQuote), [estimateQuote]);
  const requestedFeeFields = useMemo(() => buildRequestedFeeFields({ request: rpcTx, estimate: estimateQuote }), [estimateQuote, rpcTx]);
  const baselineAdvanceSetting = useMemo(() => {
    if (!estimateQuote) {
      return null;
    }

    return {
      gasLimit: estimateQuote.gasLimit,
      nonce: estimateQuote.nonce,
    } satisfies AdvanceSetting;
  }, [estimateQuote]);
  const requestedAdvanceSetting = useMemo(() => {
    if (!baselineAdvanceSetting) {
      return null;
    }

    return {
      gasLimit: gas ?? baselineAdvanceSetting.gasLimit,
      nonce: nonce != null ? Number(nonce) : baselineAdvanceSetting.nonce,
    } satisfies AdvanceSetting;
  }, [baselineAdvanceSetting, gas, nonce]);
  const [selectedFeeSelection, setSelectedFeeSelection] = useState<FeeSelection | null>(null);
  const [selectedAdvanceSetting, setSelectedAdvanceSetting] = useState<AdvanceSetting | null>(null);
  const selectionResetKey = useMemo(
    () =>
      [
        txHalf?.from ?? '',
        txHalf?.to ?? '',
        txHalf?.value ?? '',
        txHalf?.data ?? '',
        gas ?? '',
        nonce ?? '',
        gasPrice ?? '',
        maxFeePerGas ?? '',
        maxPriorityFeePerGas ?? '',
      ] as const,
    [gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, txHalf?.data, txHalf?.from, txHalf?.to, txHalf?.value],
  );
  const [showDappParamsWarning, setShowDappParamsWarning] = useState<boolean | null>(() => null);
  const abortRef = useRef<AbortController | null>(null);
  const closeActionRef = useRef<'none' | 'approving' | 'rejecting' | 'approved' | 'rejected'>('none');
  const approveResultRef = useRef<string | null>(null);
  const addressId = currentAddress?.id ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);

  useEffect(() => {
    setSelectedFeeSelection(null);
    setSelectedAdvanceSetting(null);
    setShowDappParamsWarning(null);
  }, selectionResetKey);

  useEffect(() => {
    if (!baselineAdvanceSetting) {
      return;
    }

    setSelectedFeeSelection(
      (currentSelection) => currentSelection ?? (requestedFeeFields ? { kind: 'custom', fee: requestedFeeFields } : { kind: 'preset', presetId: 'medium' }),
    );
    setSelectedAdvanceSetting((currentAdvance) => currentAdvance ?? requestedAdvanceSetting ?? baselineAdvanceSetting);
  }, [baselineAdvanceSetting, requestedAdvanceSetting, requestedFeeFields]);

  const currentFee = useMemo<ReviewFee | null>(() => {
    if (!selectedFeeSelection || !selectedAdvanceSetting) {
      return null;
    }

    const fields = pickFeeFields(selectedFeeSelection, presetOptions);
    if (!fields) {
      return null;
    }

    return {
      selection: selectedFeeSelection,
      fields,
      gasLimit: selectedAdvanceSetting.gasLimit,
      nonce: selectedAdvanceSetting.nonce,
    };
  }, [presetOptions, selectedAdvanceSetting, selectedFeeSelection]);
  const currentGasSetting = useMemo(() => resolveGasSettingWithLevel({ fee: currentFee, presetOptions }), [currentFee, presetOptions]);
  const currentAdvanceSetting = selectedAdvanceSetting ?? baselineAdvanceSetting;

  useEffect(() => {
    if (!estimateQuote || showDappParamsWarning !== null) {
      return;
    }

    const isAdvanceSettingSuitable = gas ? BigInt(gas) >= BigInt(estimateQuote.gasLimit) : true;
    const requestedPrimaryFee = requestedFeeFields ? ('gasPrice' in requestedFeeFields ? requestedFeeFields.gasPrice : requestedFeeFields.maxFeePerGas) : null;
    const isGasSettingSuitable = requestedPrimaryFee ? BigInt(requestedPrimaryFee) >= BigInt(estimateQuote.gasPrice) : true;

    if (!isAdvanceSettingSuitable || !isGasSettingSuitable) {
      setShowDappParamsWarning(true);
    }
  }, [estimateQuote, gas, requestedFeeFields, showDappParamsWarning]);

  const isSupport1559 = !!currentGasSetting && isEip1559GasSetting(currentGasSetting);
  const shouldUse1559 = isSupport1559 && (isNil(type) || (Number(type) !== 0 && Number(type) !== 1));

  const amount = useFormatBalance(value ? value.toString() : '0', nativeAsset?.decimals ?? 18);

  const _handleReject = useCallback(async () => {
    if (closeActionRef.current !== 'none') return;
    closeActionRef.current = 'rejecting';

    try {
      try {
        abortRef.current?.abort();
      } catch {
        // ignore
      }

      try {
        getExternalRequestsService().reject({ requestId });
        closeActionRef.current = 'rejected';
      } catch (error) {
        closeActionRef.current = 'none';
        console.log(error);
      } finally {
        if (navigation.canGoBack()) navigation.goBack();
      }
    } catch (e) {
      console.log(e);
    }
  }, [navigation, requestId]);

  const handleSheetClose = useCallback(() => {
    if (closeActionRef.current !== 'none') return;
    void _handleReject();
  }, [_handleReject]);

  const finalizeApprove = useCallback(
    (result: string) => {
      try {
        getExternalRequestsService().approve({ requestId, data: { result } });
        approveResultRef.current = null;
        closeActionRef.current = 'approved';
        clearHardwareSignState();
        if (navigation.canGoBack()) navigation.goBack();
      } catch (error) {
        approveResultRef.current = result;
        closeActionRef.current = 'none';
        clearHardwareSignState();
        setError(matchRPCErrorMessage(error as { message?: string; data?: string; code?: number }));
      }
    },
    [clearHardwareSignState, navigation, requestId],
  );

  const _handleApprove = useCallback(async () => {
    if (!currentGasSetting || !currentAdvanceSetting) return;
    if (!currentAddress?.id || !currentAccount?.address) return;
    if (!requestId) return;
    if (!rpcTx) return;
    if (closeActionRef.current !== 'none') return;

    const pendingApproveResult = approveResultRef.current;
    if (pendingApproveResult) {
      closeActionRef.current = 'approving';
      finalizeApprove(pendingApproveResult);
      return;
    }

    closeActionRef.current = 'approving';
    setError('');
    abortRef.current?.abort();
    const controller = currentAccount.isHardwareWallet ? new AbortController() : null;
    abortRef.current = controller;
    clearHardwareSignState();

    try {
      const gasPriceOrMaxFee = getGasSettingPrimaryFee(currentGasSetting);
      if (!gasPriceOrMaxFee) {
        return;
      }

      const requestForSend: EvmRpcTransactionRequest = {
        from: currentAccount.address,
        to: rpcTx.to,
        value: rpcTx.value ?? '0x0',
        data: (txData || '0x') as Hex,
        gas: currentAdvanceSetting.gasLimit as Hex,
        nonce: toHexQuantity(currentAdvanceSetting.nonce) as unknown as Hex,
        ...(shouldUse1559 && isEip1559GasSetting(currentGasSetting)
          ? {
              maxFeePerGas: currentGasSetting.suggestedMaxFeePerGas,
              maxPriorityFeePerGas: currentGasSetting.suggestedMaxPriorityFeePerGas,
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

      approveResultRef.current = tx.hash;
      finalizeApprove(tx.hash);
    } catch (error: unknown) {
      if (
        handleBSIMHardwareUnavailable(error, rootNavigation, {
          beforeNavigate: () => {
            clearHardwareSignState();
            abortRef.current?.abort();
          },
        })
      ) {
        closeActionRef.current = 'none';
        return;
      }

      if (controller?.signal.aborted || isUserCanceledError(error)) {
        closeActionRef.current = 'none';
        clearHardwareSignState();
        return;
      }

      if (currentAccount?.isHardwareWallet && isBsimHardwareError(error)) {
        closeActionRef.current = 'none';
        setError(error.message);
        return;
      }

      const msg = matchRPCErrorMessage(error as { message?: string; data?: string; code?: number });
      closeActionRef.current = 'none';
      setError(msg);
      clearHardwareSignState();
    } finally {
      abortRef.current = null;
    }
  }, [
    clearHardwareSignState,
    currentAccount?.address,
    currentAccount?.isHardwareWallet,
    currentAdvanceSetting,
    currentAddress?.id,
    currentGasSetting,
    metadata.icons,
    metadata.name,
    metadata.url,
    navigation,
    txData,
    requestId,
    rootNavigation,
    rpcTx,
    shouldUse1559,
    finalizeApprove,
  ]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

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
    <>
      <BottomSheetRoute
        enablePanDownToClose={!approveLoading}
        enableContentPanningGesture={!approveLoading}
        snapPoints={snapPoints.large}
        onClose={handleSheetClose}
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
            gasSetting={currentGasSetting}
            advanceSetting={currentAdvanceSetting ?? undefined}
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
        show={showGasFeeSetting}
        onClose={() => setShowGasFeeSetting(false)}
        presetOptions={presetOptions}
        fee={currentFee}
        onConfirm={(feeSelection, advanceSetting) => {
          setSelectedFeeSelection(feeSelection);
          setSelectedAdvanceSetting(advanceSetting);
        }}
        force155={!isNil(type) && (Number(type) === 0 || Number(type) === 1)}
      />
      {!!(currentAccount?.isHardwareWallet && hardwareSignState) && hardwareSignState && (
        <HardwareSignVerify
          state={hardwareSignState}
          onClose={() => {
            abortRef.current?.abort();
            clearHardwareSignState();
          }}
          onRetry={handleApprove}
        />
      )}

      {!!showDappParamsWarning && (
        <DappParamsWarning
          isOpen={!!showDappParamsWarning}
          onClose={() => setShowDappParamsWarning(false)}
          onPressUse={() => {
            if (!baselineAdvanceSetting) {
              return;
            }

            setSelectedFeeSelection({ kind: 'preset', presetId: 'medium' });
            setSelectedAdvanceSetting(baselineAdvanceSetting);
          }}
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

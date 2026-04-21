import MessageFail from '@assets/icons/message-fail.svg';
import { BottomSheetFooter, BottomSheetHeader, BottomSheetRoute, BottomSheetScrollContent, BottomSheetWrapper, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { BSIM_ERROR_CANCEL } from '@core/hardware/bsim/constants';
import type { FeeFields, FeeSelection, ReviewDappTransactionInput } from '@core/services/transaction';
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
import { getGasSettingPrimaryFee, resolveGasSettingWithLevel } from '@modules/GasFee/GasFeeSetting/gasSetting';
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
import { useDappTransactionReview, useExecuteDappTransaction } from '@service/transaction';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import Decimal from 'decimal.js';
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

const buildRequestedFeeFields = (request: EvmRpcTransactionRequest | null): FeeFields | null => {
  if (!request) {
    return null;
  }

  const requestType = request.type != null ? Number(request.type) : undefined;

  const build1559FeeFields = (): FeeFields | null => {
    const maxFeePerGas = request.maxFeePerGas;
    const maxPriorityFeePerGas = request.maxPriorityFeePerGas;

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
  const executeDappTransaction = useExecuteDappTransaction();

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

  const requestedFeeFields = useMemo(() => buildRequestedFeeFields(rpcTx), [rpcTx]);
  const requestedAdvanceSetting = useMemo(() => {
    if (!rpcTx) {
      return null;
    }

    const nextAdvanceSetting: AdvanceSetting = {
      gasLimit: gas ?? '',
      nonce: nonce != null ? Number(nonce) : Number.NaN,
    };

    if ('storageLimit' in rpcTx && typeof rpcTx.storageLimit === 'string') {
      nextAdvanceSetting.storageLimit = rpcTx.storageLimit;
    }

    return nextAdvanceSetting;
  }, [gas, nonce, rpcTx]);
  const [selectedFeeSelection, setSelectedFeeSelection] = useState<FeeSelection | null>(null);
  const [selectedAdvanceSetting, setSelectedAdvanceSetting] = useState<AdvanceSetting | null>(null);
  const [selectionSourceKey, setSelectionSourceKey] = useState<string | null>(null);
  const selectionResetKey = useMemo(
    () =>
      JSON.stringify([
        currentAccount?.address ?? '',
        rpcTx?.to ?? '',
        rpcTx?.value ?? '',
        txData ?? '',
        gas ?? '',
        nonce ?? '',
        gasPrice ?? '',
        maxFeePerGas ?? '',
        maxPriorityFeePerGas ?? '',
      ]),
    [currentAccount?.address, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, rpcTx?.to, rpcTx?.value, txData],
  );
  const [showDappParamsWarning, setShowDappParamsWarning] = useState<boolean | null>(() => null);
  const abortRef = useRef<AbortController | null>(null);
  const closeActionRef = useRef<'none' | 'approving' | 'rejecting' | 'approved' | 'rejected'>('none');
  const approveResultRef = useRef<string | null>(null);
  const addressId = currentAddress?.id ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);
  const app = useMemo(() => {
    const appIdentity = typeof metadata.url === 'string' ? metadata.url : '';

    return appIdentity
      ? {
          identity: appIdentity,
          origin: appIdentity,
          name: metadata.name || appIdentity,
          icon: Array.isArray(metadata.icons) ? metadata.icons[0] : undefined,
        }
      : null;
  }, [metadata.icons, metadata.name, metadata.url]);
  const reviewRequest = useMemo(() => {
    if (!currentAddress?.id || !currentAccount?.address || !rpcTx) {
      return null;
    }

    return {
      ...rpcTx,
      from: currentAccount.address,
      data: (txData || '0x') as Hex,
    };
  }, [currentAccount?.address, currentAddress?.id, rpcTx, txData]);
  const baselineReviewRequest = useMemo(() => {
    if (!reviewRequest) {
      return null;
    }

    return {
      from: reviewRequest.from,
      to: reviewRequest.to,
      value: reviewRequest.value,
      data: reviewRequest.data,
      type: reviewRequest.type,
    } satisfies EvmRpcTransactionRequest;
  }, [reviewRequest]);
  const baselineReviewInput = useMemo<ReviewDappTransactionInput | null>(() => {
    if (!currentAddress?.id || !baselineReviewRequest) {
      return null;
    }

    return {
      addressId: currentAddress.id,
      request: baselineReviewRequest,
      app,
    };
  }, [app, baselineReviewRequest, currentAddress?.id]);
  const baselineReviewQuery = useDappTransactionReview(baselineReviewInput);
  const baselineReview = baselineReviewQuery.data ?? null;
  const baselineAdvanceSetting = useMemo(() => {
    if (!baselineReview?.fee) {
      return null;
    }

    return {
      gasLimit: baselineReview.fee.gasLimit,
      storageLimit: baselineReview.fee.storageLimit,
      nonce: baselineReview.fee.nonce,
    } satisfies AdvanceSetting;
  }, [baselineReview?.fee]);
  const resolvedRequestedAdvanceSetting = useMemo(() => {
    if (!requestedAdvanceSetting || !baselineAdvanceSetting) {
      return null;
    }

    return {
      gasLimit: requestedAdvanceSetting.gasLimit || baselineAdvanceSetting.gasLimit,
      storageLimit: requestedAdvanceSetting.storageLimit ?? baselineAdvanceSetting.storageLimit,
      nonce: Number.isFinite(requestedAdvanceSetting.nonce) ? requestedAdvanceSetting.nonce : baselineAdvanceSetting.nonce,
    } satisfies AdvanceSetting;
  }, [baselineAdvanceSetting, requestedAdvanceSetting]);
  const reviewInput = useMemo<ReviewDappTransactionInput | null>(() => {
    if (!currentAddress?.id || !reviewRequest) {
      return null;
    }

    const override =
      selectedFeeSelection || selectedAdvanceSetting
        ? {
            ...(selectedFeeSelection ? { feeSelection: selectedFeeSelection } : {}),
            ...(selectedAdvanceSetting
              ? {
                  gasLimit: selectedAdvanceSetting.gasLimit,
                  storageLimit: selectedAdvanceSetting.storageLimit,
                  nonce: selectedAdvanceSetting.nonce,
                }
              : {}),
          }
        : undefined;

    return {
      addressId: currentAddress.id,
      request: reviewRequest,
      override,
      app,
    };
  }, [app, currentAddress?.id, reviewRequest, selectedAdvanceSetting, selectedFeeSelection]);
  const reviewQuery = useDappTransactionReview(reviewInput);
  const review = reviewQuery.data ?? null;
  const presetOptions = review?.presetOptions ?? [];
  const currentFee = review?.fee ?? null;
  const currentGasSetting = useMemo(() => resolveGasSettingWithLevel({ fee: currentFee, presetOptions }), [currentFee, presetOptions]);
  const baselineGasSetting = useMemo(
    () => (baselineReview?.fee ? resolveGasSettingWithLevel({ fee: baselineReview.fee, presetOptions: baselineReview.presetOptions }) : null),
    [baselineReview?.fee, baselineReview?.presetOptions],
  );
  const currentAdvanceSetting = selectedAdvanceSetting ?? baselineAdvanceSetting;

  useEffect(() => {
    if (!baselineAdvanceSetting || !baselineReview?.fee) {
      return;
    }

    const isNewSelectionSource = selectionSourceKey !== selectionResetKey;
    if (isNewSelectionSource) {
      setSelectedFeeSelection(requestedFeeFields ? { kind: 'custom', fee: requestedFeeFields } : { kind: 'preset', presetId: 'medium' });
      setSelectedAdvanceSetting(resolvedRequestedAdvanceSetting ?? baselineAdvanceSetting);
      setShowDappParamsWarning(null);
      setSelectionSourceKey(selectionResetKey);
      return;
    }

    setSelectedFeeSelection(
      (currentSelection) => currentSelection ?? (requestedFeeFields ? { kind: 'custom', fee: requestedFeeFields } : { kind: 'preset', presetId: 'medium' }),
    );
    setSelectedAdvanceSetting((currentAdvance) => currentAdvance ?? resolvedRequestedAdvanceSetting ?? baselineAdvanceSetting);
  }, [baselineAdvanceSetting, baselineReview?.fee, requestedFeeFields, resolvedRequestedAdvanceSetting, selectionResetKey, selectionSourceKey]);

  useEffect(() => {
    if (!baselineReview?.fee || !baselineGasSetting || showDappParamsWarning !== null) {
      return;
    }

    const basePrimaryFee = getGasSettingPrimaryFee(baselineGasSetting);
    const isAdvanceSettingSuitable = gas ? BigInt(gas) >= BigInt(baselineReview.fee.gasLimit) : true;
    const requestedPrimaryFee = requestedFeeFields ? ('gasPrice' in requestedFeeFields ? requestedFeeFields.gasPrice : requestedFeeFields.maxFeePerGas) : null;
    const isGasSettingSuitable = requestedPrimaryFee && basePrimaryFee ? BigInt(requestedPrimaryFee) >= BigInt(basePrimaryFee) : true;

    if (!isAdvanceSettingSuitable || !isGasSettingSuitable) {
      setShowDappParamsWarning(true);
    }
  }, [baselineGasSetting, baselineReview?.fee, gas, requestedFeeFields, showDappParamsWarning]);

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
    if (!currentAddress?.id || !currentAccount?.address) return;
    if (!requestId) return;
    if (!review?.prepared) return;
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
      const refreshed = await reviewQuery.refetch({ throwOnError: true });
      const prepared = refreshed.data?.prepared;

      if (!prepared) {
        return;
      }

      const tx = await executeDappTransaction(prepared, { signal: controller?.signal });

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
    currentAddress?.id,
    executeDappTransaction,
    requestId,
    review?.prepared,
    reviewQuery,
    rootNavigation,
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
        force155={type != null && (Number(type) === 0 || Number(type) === 1)}
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

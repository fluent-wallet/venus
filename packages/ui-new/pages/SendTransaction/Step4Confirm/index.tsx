import ProhibitIcon from '@assets/icons/prohibit.svg';
import WarnIcon from '@assets/icons/warn.svg';
import { BottomSheetFooter, BottomSheetScrollContent } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import type { FeeSelection, TransactionReviewOverride } from '@core/services/transaction';
import { AssetType, NetworkType } from '@core/types';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItemsGrid';
import GasFeeSetting, { type AdvanceSetting } from '@modules/GasFee/GasFeeSetting';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import { resolveGasSettingWithLevel } from '@modules/GasFee/GasFeeSetting/gasSetting';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { SendTransactionScreenProps, SendTransactionStep4StackName, StackNavigation } from '@router/configs';
import { useCurrentAccount, useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { getAssetsSyncService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { useExecuteTransfer, useTransferReview } from '@service/transaction';
import backToHome from '@utils/backToHome';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import { isSmallDevice } from '@utils/deviceInfo';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import Decimal from 'decimal.js';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { buildTransferIntent, type TransferAsset, toLegacyNftItem, useSendFlow } from '../flow';
import HardwareSignVerify from '../HardwareSignVerify';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import { NFT } from '../Step3Amount';
import { getTransferPrecheckQueryErrorTranslationKey } from '../Step3Amount/amountInputHelpers';
import SendAsset from './SendAsset';
import { useHardwareSigningUiState } from './useHardwareSigningUiState';

const isUserCanceledError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === AUTH_PASSWORD_REQUEST_CANCELED) return true;
  if (code === 'CANCEL') return true;

  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'AbortError') return true;

  return false;
};

const SendTransactionStep4Confirm: React.FC<SendTransactionScreenProps<typeof SendTransactionStep4StackName>> = () => {
  useEffect(() => Keyboard.dismiss(), []);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rootNavigation = useNavigation<StackNavigation>();
  const { draft } = useSendFlow();

  const { data: currentNetwork } = useCurrentNetwork();
  const { data: currentAccount } = useCurrentAccount();
  const { data: currentAddress } = useCurrentAddress();
  const { data: assets } = useAssetsOfCurrentAddress();
  const asset = draft.asset as TransferAsset;
  const nftItemDetail = toLegacyNftItem(asset);
  const nativeAsset = useMemo(() => assets?.find((a) => a.type === AssetType.Native) ?? null, [assets]);
  const transferIntent = useMemo(() => {
    if (!currentNetwork) {
      return null;
    }

    return buildTransferIntent({
      recipient: draft.recipient,
      asset,
      amountIntent: draft.amountIntent,
      networkType: currentNetwork.networkType,
    });
  }, [asset, currentNetwork, draft.amountIntent, draft.recipient]);

  const [showGasFeeSetting, setShowGasFeeSetting] = useState(false);
  const [reviewOverride, setReviewOverride] = useState<TransactionReviewOverride | undefined>(undefined);
  const [error, setError] = useState<{ type?: string; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reviewInput = useMemo(
    () =>
      currentAddress?.id && transferIntent
        ? {
            addressId: currentAddress.id,
            intent: transferIntent,
            override: reviewOverride,
          }
        : null,
    [currentAddress?.id, reviewOverride, transferIntent],
  );
  const reviewQuery = useTransferReview(reviewInput);
  const review = reviewQuery.data ?? null;
  const reviewSummary = review?.summary ?? null;
  const resolvedAmount = reviewSummary?.transfer.amount ?? null;
  const resolvedPayableFee = useMemo(() => {
    if (!reviewSummary?.fee) {
      return null;
    }

    return new Decimal(reviewSummary.fee.payableGasFee || '0').plus(reviewSummary.fee.payableStorageCollateral || '0').toString();
  }, [reviewSummary?.fee]);
  const amount = resolvedAmount ?? '';
  const formattedAmount = useFormatBalance(amount);
  const price = useMemo(() => calculateTokenPrice({ price: asset.priceInUSDT, amount: amount }), [asset.priceInUSDT, amount]);
  const symbol = useMemo(() => {
    if (!nftItemDetail) {
      return asset.symbol;
    }
    return getDetailSymbol(nftItemDetail);
  }, [asset.symbol, nftItemDetail]);
  const addressId = currentAddress?.id ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);
  const currentAddressValue = currentAddress?.value ?? '';
  const executeTransfer = useExecuteTransfer();
  const currentGasSetting = useMemo(
    () => resolveGasSettingWithLevel({ fee: review?.fee ?? null, presetOptions: review?.presetOptions ?? [] }),
    [review?.fee, review?.presetOptions],
  );
  const currentAdvanceSetting = useMemo(() => {
    if (!review?.fee) {
      return undefined;
    }

    return {
      gasLimit: review.fee.gasLimit,
      storageLimit: review.fee.storageLimit,
      nonce: review.fee.nonce,
    } satisfies AdvanceSetting;
  }, [review?.fee]);
  const reviewErrorMessage = useMemo(() => {
    if (reviewQuery.error) {
      return t(getTransferPrecheckQueryErrorTranslationKey(reviewQuery.error));
    }

    const reviewError = review?.error;
    if (!reviewError) {
      return null;
    }

    if (reviewError.code === 'insufficient_asset_balance') {
      return t('tx.amount.error.InsufficientBalance', { symbol: asset.symbol });
    }

    if (reviewError.code === 'insufficient_native_for_fee') {
      return asset.type === AssetType.Native
        ? t('tx.confirm.error.InsufficientBalance', { symbol: nativeAsset?.symbol ?? asset.symbol })
        : t('tx.confirm.error.InsufficientBalanceForGas', { symbol: nativeAsset?.symbol ?? 'CFX' });
    }

    if (reviewError.code === 'invalid_amount') {
      return t('tx.amount.error.invalidAmount');
    }

    if (reviewError.code === 'sponsor_check_failed') {
      return reviewError.message;
    }

    return reviewError.message;
  }, [asset.symbol, asset.type, nativeAsset?.symbol, review?.error, reviewQuery.error, t]);
  useEffect(() => {
    if (!reviewErrorMessage) {
      setError(null);
      return;
    }

    setError((prev) => {
      if (prev?.message === reviewErrorMessage) {
        return prev;
      }

      return {
        message: reviewErrorMessage,
        ...(reviewQuery.error ? { type: 'network error' } : review?.error?.code === 'insufficient_native_for_fee' ? { type: 'out of balance' } : null),
      };
    });
  }, [review?.error?.code, reviewErrorMessage, reviewQuery.error]);
  const handleReviewOverrideConfirm = useCallback((feeSelection: FeeSelection, advanceSetting: AdvanceSetting) => {
    setError(null);
    setReviewOverride({
      feeSelection,
      gasLimit: advanceSetting.gasLimit,
      storageLimit: advanceSetting.storageLimit,
      nonce: advanceSetting.nonce,
    });
  }, []);

  const _handleSend = useCallback(async () => {
    if (!currentNetwork || !currentAccount || !currentAddress) return;
    if (!review?.prepared) return;

    if (currentAccount.isHardwareWallet && currentNetwork.networkType === NetworkType.Conflux) {
      showMessage({
        message: 'BSIM not support Conflux Core',
        type: 'warning',
      });
      return;
    }

    setError(null);

    abortRef.current?.abort();
    const controller = currentAccount.isHardwareWallet ? new AbortController() : null;
    abortRef.current = controller;
    clearHardwareSignState();

    try {
      await executeTransfer(review.prepared, { signal: controller?.signal });

      showMessage({
        type: 'success',
        message: t('tx.confirm.submitted.message'),
        description: t('tx.confirm.submitted.description'),
        icon: 'loading' as unknown as undefined,
      });

      backToHome(rootNavigation);

      try {
        void getAssetsSyncService().refreshCurrent({ reason: 'manual' });
      } catch {
        //
      }
    } catch (_err: unknown) {
      console.log(_err);
      if (controller?.signal.aborted) {
        clearHardwareSignState();
        return;
      }

      if (
        handleBSIMHardwareUnavailable(_err, rootNavigation, {
          beforeNavigate: () => {
            clearHardwareSignState();
            abortRef.current?.abort();
          },
        })
      ) {
        return;
      }

      if (isUserCanceledError(_err)) {
        clearHardwareSignState();
        return;
      }

      const rpcError = _err as { code?: number; data?: string; message?: string } | null;
      const errString = String(rpcError?.data || rpcError?.message || _err);
      const msg = matchRPCErrorMessage(rpcError ?? {});
      setError({
        message: errString,
        ...(errString.includes('out of balance') ? { type: 'out of balance' } : errString.includes('timed out') ? { type: 'network error' } : null),
      });
      if (hardwareSignState?.phase !== 'error') {
        showMessage({
          message: t('tx.confirm.failed'),
          description: msg,
          type: 'failed',
        });
      }
    } finally {
      abortRef.current = null;
    }
  }, [clearHardwareSignState, currentAccount, currentAddress, currentNetwork, hardwareSignState?.phase, rootNavigation, review?.prepared, t, executeTransfer]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);

  const showHardwareSignVerify =
    Boolean(currentAccount?.isHardwareWallet) && Boolean(hardwareSignState) && (hardwareSignState?.phase === 'start' || hardwareSignState?.phase === 'error');
  const isReviewLoading = reviewQuery.isFetching && !review;
  const canSend = !reviewQuery.error && review?.canSubmit === true && !!review?.prepared;
  const sponsorMessage = review?.sponsor?.message ?? null;

  return (
    <>
      <SendTransactionBottomSheet
        title={t('tx.confirm.title')}
        enablePanDownToClose={!inSending}
        enableContentPanningGesture={!inSending}
        enableHandlePanningGesture={!inSending}
        isRoute
        useBottomSheetView={false}
      >
        <BottomSheetScrollContent
          // only support android: https://reactnative.dev/docs/scrollview#persistentscrollbar-android
          persistentScrollbar
        >
          <Text style={[styles.sendTitle, { color: colors.textPrimary, marginBottom: isSmallDevice ? 16 : 24 }]}>{t('common.send')}</Text>

          {nftItemDetail && <NFT colors={colors} asset={asset} nftItemDetail={nftItemDetail} />}
          <SendAsset
            amount={asset.type !== AssetType.ERC721 ? (nftItemDetail ? amount : formattedAmount) : undefined}
            symbol={asset.type !== AssetType.ERC721 ? symbol : undefined}
            price={price}
            icon={asset.type === AssetType.Native || asset.type === AssetType.ERC20 ? asset.icon : undefined}
            recipientAddress={draft.recipient}
          />
        </BottomSheetScrollContent>
        <BottomSheetFooter>
          <View style={[styles.divider, { backgroundColor: colors.borderFourth, marginVertical: isSmallDevice ? 16 : 24 }]} />

          <Text style={[styles.signWith, { color: colors.textSecondary }]}>{t('tx.confirm.signingWith')}</Text>
          <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAddressValue} colors={colors}>
            <Text style={[styles.networkName, { color: colors.textSecondary }]} numberOfLines={1}>
              on {currentNetwork?.name}
            </Text>
          </AccountItemView>

          <Text style={[styles.estimateFee, { color: colors.textSecondary }]}>{t('tx.confirm.estimatedFee')}</Text>
          <EstimateFee
            gasSetting={currentGasSetting}
            advanceSetting={currentAdvanceSetting}
            onPressSettingIcon={() => setShowGasFeeSetting(true)}
            feeAmountOverride={resolvedPayableFee}
          />

          {sponsorMessage && <Text style={[styles.sponsorTip, { color: colors.textSecondary }]}>{sponsorMessage}</Text>}

          {error && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderFourth, marginVertical: isSmallDevice ? 16 : 24 }]} />
              {error.type === 'out of balance' ? (
                <View style={styles.errorWarp}>
                  <WarnIcon style={styles.errorIcon} color={colors.middle} width={24} height={24} />
                  <Text style={[styles.errorText, { color: colors.middle }]}>
                    {`${asset.type === AssetType.Native ? t('tx.confirm.error.InsufficientBalance', { symbol: nativeAsset?.symbol }) : t('tx.confirm.error.InsufficientBalanceForGas', { symbol: nativeAsset?.symbol })}`}
                  </Text>
                </View>
              ) : (
                <View style={styles.errorWarp}>
                  <ProhibitIcon style={styles.errorIcon} width={24} height={24} />
                  {error.type === 'network error' ? (
                    <Text style={[styles.errorText, { color: colors.down }]}>{t('tx.confirm.error.network')}</Text>
                  ) : (
                    <Text style={[styles.errorText, { color: colors.down }]}>{error.message || t('tx.confirm.error.unknown')}</Text>
                  )}
                </View>
              )}
            </>
          )}

          <View style={[styles.btnArea, { marginTop: error ? 16 : 40 }]}>
            <Button testID="cancel" style={styles.btn} size="small" onPress={() => backToHome(rootNavigation)} disabled={inSending}>
              {t('common.cancel')}
            </Button>
            <Button testID="send" style={styles.btn} size="small" disabled={!canSend} onPress={handleSend} loading={inSending || isReviewLoading}>
              {error ? t('common.retry') : t('common.send')}
            </Button>
          </View>
        </BottomSheetFooter>
      </SendTransactionBottomSheet>

      {showHardwareSignVerify && hardwareSignState && (
        <HardwareSignVerify
          state={hardwareSignState}
          onClose={() => {
            abortRef.current?.abort();
            clearHardwareSignState();
          }}
          onRetry={handleSend}
        />
      )}

      <GasFeeSetting
        show={showGasFeeSetting}
        onClose={() => setShowGasFeeSetting(false)}
        presetOptions={review?.presetOptions ?? []}
        fee={review?.fee ?? null}
        onConfirm={handleReviewOverrideConfirm}
      />
    </>
  );
};

export const styles = StyleSheet.create({
  sendTitle: {
    marginTop: 16,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  divider: {
    width: '100%',
    height: 1,
  },
  signWith: {
    marginVertical: 4,
    fontSize: 14,
    fontWeight: '300',
    paddingHorizontal: 16,
  },
  networkName: {
    fontSize: 12,
    fontWeight: '300',
    maxWidth: '60%',
    marginTop: 12,
    marginRight: 16,
    alignSelf: 'flex-start',
  },
  estimateFee: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '300',
    paddingHorizontal: 56,
  },
  sponsorTip: {
    marginTop: 8,
    paddingHorizontal: 56,
    fontSize: 12,
    lineHeight: 16,
  },
  errorWarp: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  errorIcon: {
    marginRight: 4,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default SendTransactionStep4Confirm;

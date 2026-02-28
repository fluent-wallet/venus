import ProhibitIcon from '@assets/icons/prohibit.svg';
import WarnIcon from '@assets/icons/warn.svg';
import { BottomSheetFooter, BottomSheetScrollContent } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { buildTransactionPayload } from '@core/chains/utils/transactionBuilder';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { AssetType, NetworkType } from '@core/types';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { AccountItemView } from '@modules/AccountsList';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItemsGrid';
import GasFeeSetting, { type GasEstimate } from '@modules/GasFee/GasFeeSetting';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { SendTransactionScreenProps, SendTransactionStep4StackName, StackNavigation } from '@router/configs';
import { useCurrentAccount, useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { getAssetsSyncService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { useSendERC20, useSendNative } from '@service/transaction';
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
import HardwareSignVerify from '../HardwareSignVerify';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import { NFT } from '../Step3Amount';
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

const SendTransactionStep4Confirm: React.FC<SendTransactionScreenProps<typeof SendTransactionStep4StackName>> = ({ navigation, route }) => {
  useEffect(() => Keyboard.dismiss(), []);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rootNavigation = useNavigation<StackNavigation>();

  const { data: currentNetwork } = useCurrentNetwork();
  const { data: currentAccount } = useCurrentAccount();
  const { data: currentAddress } = useCurrentAddress();
  const { data: assets } = useAssetsOfCurrentAddress();

  const {
    params: { asset, amount: _amount, nftItemDetail, recipientAddress, inMaxMode },
  } = route;

  const [showGasFeeSetting, setShowGasFeeSetting] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [gasCost, setGasCost] = useState<string | null>(null);

  const amount = useMemo(() => {
    if (!inMaxMode || asset.type !== AssetType.Native) {
      return _amount;
    }
    if (!gasCost) return _amount;
    return new Decimal(_amount).sub(gasCost).toString();
  }, [_amount, gasCost, inMaxMode]);

  const formattedAmount = useFormatBalance(amount);

  const price = useMemo(() => calculateTokenPrice({ price: asset.priceInUSDT, amount: amount }), [asset.priceInUSDT, amount]);
  const symbol = useMemo(() => {
    if (!nftItemDetail) {
      return asset.symbol;
    }
    return getDetailSymbol(nftItemDetail);
  }, [asset.symbol, nftItemDetail]);

  const txHalf = useMemo(() => {
    if (!currentNetwork || !currentAddress?.value) return null;

    const contractAddress = asset.type !== AssetType.Native && asset.contractAddress ? asset.contractAddress : undefined;
    const nftTokenId = nftItemDetail?.tokenId;

    const payload = buildTransactionPayload({
      from: currentAddress.value,
      to: recipientAddress,
      amount: amount || '0',
      assetType: asset.type as unknown as AssetType,
      assetDecimals: asset.decimals || 0,
      chainId: currentNetwork.chainId,
      contractAddress,
      nftTokenId,
    });

    return {
      from: payload.from,
      to: payload.to,
      value: payload.value,
      data: payload.data,
    };
  }, [asset, amount, currentAddress?.value, currentNetwork?.chainId, recipientAddress, nftItemDetail?.tokenId]);

  const [error, setError] = useState<{ type?: string; message: string } | null>(null);

  const sendNative = useSendNative();
  const sendERC20 = useSendERC20();

  const abortRef = useRef<AbortController | null>(null);

  const addressId = currentAddress?.id ?? '';
  const { state: hardwareSignState, clear: clearHardwareSignState } = useHardwareSigningUiState(addressId || undefined);

  const currentAddressValue = currentAddress?.value ?? '';

  const _handleSend = useCallback(async () => {
    if (!currentNetwork || !currentAccount || !currentAddress) return;

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
      const gasLimit = gasEstimate?.advanceSetting?.gasLimit;
      const storageLimit = gasEstimate?.advanceSetting?.storageLimit;
      const nonce = gasEstimate?.advanceSetting?.nonce;

      const maxFeePerGas = gasEstimate?.gasSetting?.suggestedMaxFeePerGas;
      const maxPriorityFeePerGas = gasEstimate?.gasSetting?.suggestedMaxPriorityFeePerGas;
      const gasPrice = gasEstimate?.gasSetting?.suggestedGasPrice;

      const signal = controller?.signal;

      if (asset.type === AssetType.ERC20 && asset.contractAddress) {
        await sendERC20({
          addressId: currentAddress.id,
          contractAddress: asset.contractAddress,
          to: recipientAddress,
          amount: amount || '0',
          assetDecimals: asset.decimals || 0,
          gasLimit,
          storageLimit,
          nonce: typeof nonce === 'number' ? nonce : undefined,
          gasPrice,
          maxFeePerGas,
          maxPriorityFeePerGas,
          signal,
        });
      } else {
        const contractAddress = asset.type !== AssetType.Native && asset.contractAddress ? asset.contractAddress : undefined;
        await sendNative({
          addressId: currentAddress.id,
          to: recipientAddress,
          amount: amount || '0',
          assetType: asset.type as unknown as AssetType,
          assetDecimals: asset.decimals || 0,
          contractAddress,
          nftTokenId: nftItemDetail?.tokenId,
          gasLimit,
          storageLimit,
          nonce: typeof nonce === 'number' ? nonce : undefined,
          gasPrice,
          maxFeePerGas,
          maxPriorityFeePerGas,
          signal,
        });
      }

      showMessage({
        type: 'success',
        message: t('tx.confirm.submitted.message'),
        description: t('tx.confirm.submitted.description'),
        icon: 'loading' as unknown as undefined,
      });

      backToHome(navigation);

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

      const errString = String((_err as any)?.data || (_err as any)?.message || _err);
      const msg = matchRPCErrorMessage(_err as any);
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
  }, [
    amount,
    asset,
    clearHardwareSignState,
    currentAccount,
    currentAddress,
    currentNetwork,
    gasEstimate,
    hardwareSignState?.phase,
    navigation,
    nftItemDetail?.tokenId,
    recipientAddress,
    rootNavigation,
    sendERC20,
    sendNative,
    t,
  ]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);

  const nativeAsset = useMemo(() => assets?.find((a) => a.type === AssetType.Native) ?? null, [assets]);
  const showHardwareSignVerify =
    Boolean(currentAccount?.isHardwareWallet) && Boolean(hardwareSignState) && (hardwareSignState?.phase === 'start' || hardwareSignState?.phase === 'error');

  return (
    <>
      <SendTransactionBottomSheet
        title={t('tx.confirm.title')}
        enablePanDownToClose={!inSending}
        enableContentPanningGesture={!inSending}
        enableHandlePanningGesture={!inSending}
        isRoute
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
            recipientAddress={recipientAddress}
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
            gasSetting={gasEstimate?.gasSetting}
            advanceSetting={gasEstimate?.advanceSetting ?? gasEstimate?.estimateAdvanceSetting}
            onPressSettingIcon={() => setShowGasFeeSetting(true)}
            onGasCostChange={(newGasCost) => setGasCost(newGasCost)}
          />

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
                    <Text style={[styles.errorText, { color: colors.down }]}>{t('tx.confirm.error.unknown')}</Text>
                  )}
                </View>
              )}
            </>
          )}

          <View style={[styles.btnArea, { marginTop: error ? 16 : 40 }]}>
            <Button testID="cancel" style={styles.btn} size="small" onPress={() => backToHome(navigation)} disabled={inSending}>
              {t('common.cancel')}
            </Button>
            <Button testID="send" style={styles.btn} size="small" disabled={!gasEstimate} onPress={handleSend} loading={inSending}>
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

      <GasFeeSetting show={showGasFeeSetting} tx={txHalf} onClose={() => setShowGasFeeSetting(false)} onConfirm={setGasEstimate} />
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

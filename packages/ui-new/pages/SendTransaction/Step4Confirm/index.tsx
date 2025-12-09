import { getAssetsTracker, getEventBus, getNFTDetailTracker } from '@WalletCoreExtends/index';
import { isAuthenticationCanceledError, isAuthenticationError } from '@WalletCoreExtends/Plugins/Authentication/errors';
import { BSIMEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import ProhibitIcon from '@assets/icons/prohibit.svg';
import WarnIcon from '@assets/icons/warn.svg';
import { BottomSheetFooter, BottomSheetScrollContent } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import { processError } from '@core/utils/eth';
import { TransactionActionType } from '@core/WalletCore/Events/broadcastTransactionSubject';
import { BROADCAST_TRANSACTION_EVENT } from '@core/WalletCore/Events/eventTypes';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import {
  AssetSource,
  AssetType,
  NetworkType,
  useCurrentAccount,
  useCurrentAddress,
  useCurrentAddressValue,
  useCurrentNetwork,
  useCurrentNetworkNativeAsset,
  useVaultOfAccount,
  VaultType,
} from '@core/WalletCore/Plugins/ReactInject';
import type { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { SignTransactionCancelError, useSignTransaction } from '@hooks/useSignTransaction';
import { AccountItemView } from '@modules/AccountsList';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import GasFeeSetting, { type GasEstimate } from '@modules/GasFee/GasFeeSetting';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { SendTransactionScreenProps, SendTransactionStep4StackName, StackNavigation } from '@router/configs';
import backToHome from '@utils/backToHome';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import { isSmallDevice } from '@utils/deviceInfo';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import matchRPCErrorMessage from '@utils/matchRPCErrorMssage';
import Decimal from 'decimal.js';
import { BSIMError } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import BSIMVerify, { useBSIMVerify } from '../BSIMVerify';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import { NFT } from '../Step3Amount';
import SendAsset from './SendAsset';

const SendTransactionStep4Confirm: React.FC<SendTransactionScreenProps<typeof SendTransactionStep4StackName>> = ({ navigation, route }) => {
  useEffect(() => Keyboard.dismiss(), []);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rootNavigation = useNavigation<StackNavigation>();
  const currentNetwork = useCurrentNetwork()!;
  const nativeAsset = useCurrentNetworkNativeAsset()!;
  const currentAddress = useCurrentAddress()!;
  const currentAddressValue = useCurrentAddressValue()!;
  const currentAccount = useCurrentAccount();
  const currentVault = useVaultOfAccount(currentAccount?.id);

  const signTransaction = useSignTransaction();

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
  }, []);

  const txHalf = useMemo(() => {
    return plugins.Transaction.buildTransaction({
      asset,
      amount: amount || '0',
      recipientAddress,
      currentAddressValue,
      currentNetwork,
      nftTokenId: nftItemDetail?.tokenId,
    });
  }, [asset, amount, recipientAddress, currentAddressValue, currentNetwork, nftItemDetail?.tokenId]);

  const [error, setError] = useState<{ type?: string; message: string } | null>(null);

  const { bsimEvent, setBSIMEvent, execBSIMCancel, setBSIMCancel } = useBSIMVerify();
  const epochHeightRef = useRef('');

  const _handleSend = useCallback(async () => {
    if (currentVault?.type === VaultType.BSIM && currentNetwork.networkType === NetworkType.Conflux) {
      showMessage({
        message: 'BSIM not support Conflux Core',
        type: 'warning',
      });
      return;
    }
    setBSIMEvent(null);
    execBSIMCancel();

    let txRaw!: string;
    let txHash!: string;
    let tx!: ITxEvm;
    let signature: Signature | undefined;
    let txError!: any;
    try {
      if (asset.type === AssetType.ERC20 && asset.contractAddress) {
        const isInDB = await methods.queryAssetByAddress(currentNetwork.id, asset.contractAddress);
        if (!isInDB) {
          await methods.createAsset({
            network: currentNetwork,
            ...asset,
            source: AssetSource.Custom,
          });
        }
      }

      tx = { ...txHalf };

      if (gasEstimate?.advanceSetting?.gasLimit) {
        tx.gasLimit = gasEstimate.advanceSetting.gasLimit;
      }

      if (gasEstimate?.advanceSetting?.storageLimit) {
        tx.storageLimit = gasEstimate.advanceSetting.storageLimit;
      }

      if (gasEstimate?.gasSetting?.suggestedMaxFeePerGas) {
        // EIP-1559 transaction
        tx.type = 2;
        tx.maxFeePerGas = gasEstimate.gasSetting.suggestedMaxFeePerGas;
        tx.maxPriorityFeePerGas = gasEstimate.gasSetting.suggestedMaxPriorityFeePerGas;
      } else if (gasEstimate?.gasSetting?.suggestedGasPrice) {
        // Legacy transaction
        tx.type = 0;
        tx.gasPrice = gasEstimate.gasSetting.suggestedGasPrice;
      }

      if (gasEstimate?.advanceSetting?.nonce) {
        tx.nonce = gasEstimate.advanceSetting.nonce;
      }

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

        const { txRawPromise, cancel } = await signTransaction({
          ...tx,
          epochHeight: epochHeightRef.current,
        });
        setBSIMCancel(cancel);
        txRaw = await txRawPromise;
        signature = await methods.createSignature({
          address: currentAddress,
          signType: SignType.TX,
        });
        txHash = await plugins.Transaction.sendRawTransaction({
          txRaw,
          network: currentNetwork,
        });

        setBSIMEvent(null);
        showMessage({
          type: 'success',
          message: t('tx.confirm.submitted.message'),
          description: t('tx.confirm.submitted.description'),
          icon: 'loading' as unknown as undefined,
        });
        backToHome(navigation);
        getAssetsTracker().updateCurrentTracker();
        if (nftItemDetail) {
          getNFTDetailTracker().updateCurrentOpenNFT();
        }
      } catch (error) {
        if (error instanceof BSIMError) {
          setBSIMEvent({
            type: BSIMEventTypesName.ERROR,
            message: error?.message,
          });
        } else {
          // throw error to outer catch
          throw error;
        }
      }
    } catch (_err: any) {
      if (
        handleBSIMHardwareUnavailable(_err, rootNavigation, {
          beforeNavigate: () => {
            setBSIMEvent(null);
            execBSIMCancel();
          },
        })
      ) {
        return;
      }
      if (isAuthenticationError(_err) && isAuthenticationCanceledError(_err)) {
        return;
      }

      txError = _err;
      setBSIMEvent(null);
      if (txError instanceof SignTransactionCancelError) {
        // ignore cancel error
        return;
      }
      const errString = String(txError.data || txError?.message || txError);
      const msg = matchRPCErrorMessage(txError);
      setError({
        message: errString,
        ...(errString.includes('out of balance') ? { type: 'out of balance' } : errString.includes('timed out') ? { type: 'network error' } : null),
      });
      showMessage({
        message: t('tx.confirm.failed'),
        description: msg,
        type: 'failed',
      });
    } finally {
      if (txRaw) {
        getEventBus().dispatch(BROADCAST_TRANSACTION_EVENT, {
          transactionType: TransactionActionType.Send,
          params: {
            txHash,
            txRaw,
            tx,
            address: currentAddress,
            signature,
            extraParams: {
              assetType: asset.type,
              contractAddress: asset.type !== AssetType.Native ? asset.contractAddress : undefined,
              sendAt: new Date(),
              epochHeight: currentNetwork.networkType === NetworkType.Conflux ? epochHeightRef.current : null,
              err: txError && String(txError.data || txError?.message || txError),
              errorType: txError && processError(txError).errorType,
              method: asset.type === AssetType.ERC721 ? 'transferFrom' : asset.type === AssetType.ERC1155 ? 'safeTransferFrom' : 'transfer',
            },
          },
        });
      }
    }
  }, [txHalf, gasEstimate, currentVault?.id, currentNetwork?.id]);

  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);
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
              {error.type === 'out of balance ' ? (
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
      {bsimEvent && (
        <BSIMVerify
          bsimEvent={bsimEvent}
          onClose={() => {
            setBSIMEvent(null);
            execBSIMCancel();
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

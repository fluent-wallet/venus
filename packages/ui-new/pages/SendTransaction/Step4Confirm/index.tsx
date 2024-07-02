/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable react-hooks/exhaustive-deps */
import { BSIMEventTypesName } from '@WalletCoreExtends/Plugins/BSIM/types';
import ProhibitIcon from '@assets/icons/prohibit.svg';
import WarnIcon from '@assets/icons/warn.svg';
import { convertCfxToHex } from '@cfx-kit/dapp-utils/dist/address';
import { createERC20Contract, createERC721Contract, createERC1155Contract } from '@cfx-kit/dapp-utils/dist/contract';
import { BottomSheetScrollContent, BottomSheetFooter } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import events from '@core/WalletCore/Events';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import {
  AssetSource,
  AssetType,
  NetworkType,
  VaultType,
  useCurrentAccount,
  useCurrentAddress,
  useCurrentAddressValue,
  useCurrentNetwork,
  useCurrentNetworkNativeAsset,
  useVaultOfAccount,
} from '@core/WalletCore/Plugins/ReactInject';
import type { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import { processError } from '@core/utils/eth';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import { SignTransactionCancelError, useSignTransaction } from '@hooks/useSignTransaction';
import { AccountItemView } from '@modules/AccountsList';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import GasFeeSetting, { type GasEstimate } from '@modules/GasFee/GasFeeSetting';
import EstimateFee from '@modules/GasFee/GasFeeSetting/EstimateFee';
import { useTheme } from '@react-navigation/native';
import type { SendTransactionScreenProps, SendTransactionStep4StackName } from '@router/configs';
import backToHome from '@utils/backToHome';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
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

  const currentNetwork = useCurrentNetwork()!;
  const nativeAsset = useCurrentNetworkNativeAsset()!;
  const currentAddress = useCurrentAddress()!;
  const currentAddressValue = useCurrentAddressValue()!;
  const currentAccount = useCurrentAccount();
  const currentVault = useVaultOfAccount(currentAccount?.id);

  const signTransaction = useSignTransaction();

  const {
    params: { asset, amount, nftItemDetail, recipientAddress },
  } = route;

  const [showGasFeeSetting, setShowGasFeeSetting] = useState(false);

  const formattedAmount = useFormatBalance(amount);
  const price = useMemo(() => calculateTokenPrice({ price: asset.priceInUSDT, amount: amount }), [asset.priceInUSDT, amount]);
  const symbol = useMemo(() => {
    if (!nftItemDetail) {
      return asset.symbol;
    }
    return getDetailSymbol(nftItemDetail);
  }, []);

  const transferAmountHex = useMemo(() => new Decimal(amount || 0).mul(Decimal.pow(10, nftItemDetail ? 0 : asset.decimals || 0)).toHex(), []);

  const txHalf = useMemo(() => {
    let data = '0x';
    if (asset.type === AssetType.ERC20) {
      const contract = createERC20Contract(asset.contractAddress);
      data = contract.encodeFunctionData('transfer', [
        (currentNetwork.networkType === NetworkType.Conflux ? convertCfxToHex(recipientAddress) : recipientAddress) as `0x${string}`,
        transferAmountHex as unknown as bigint,
      ]);
    } else if (asset.type === AssetType.ERC721) {
      const contract = createERC721Contract(asset.contractAddress);
      data = contract.encodeFunctionData('transferFrom', [
        currentAddressValue as `0x${string}`,
        recipientAddress as `0x${string}`,
        nftItemDetail?.tokenId as unknown as bigint,
      ]);
    } else if (asset.type === AssetType.ERC1155) {
      const contract = createERC1155Contract(asset.contractAddress);
      data = contract.encodeFunctionData('safeTransferFrom', [
        currentAddressValue as `0x${string}`,
        recipientAddress as `0x${string}`,
        nftItemDetail?.tokenId as unknown as bigint,
        transferAmountHex as unknown as bigint,
        '0x',
      ]);
    }

    return {
      to: asset.type === AssetType.Native ? recipientAddress : asset.contractAddress,
      value: asset.type === AssetType.Native ? transferAmountHex : '0x0',
      data,
      from: currentAddressValue,
      chainId: currentNetwork.chainId,
    } as ITxEvm;
  }, []);

  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);

  const [error, setError] = useState<{ type?: string; message: string } | null>(null);

  const { bsimEvent, setBSIMEvent, execBSIMCancel, setBSIMCancel } = useBSIMVerify();
  const epochHeightRef = useRef('');

  const _handleSend = useCallback(async () => {
    setBSIMEvent(null);
    execBSIMCancel();

    let txRaw!: string;
    let txHash!: string;
    let tx!: ITxEvm;
    let signature: Signature | undefined = undefined;
    let txError!: any;
    try {
      if (asset.type === AssetType.ERC20 && asset.contractAddress) {
        const isInDB = await currentNetwork.queryAssetByAddress(asset.contractAddress);
        if (!isInDB) {
          await methods.createAsset({
            network: currentNetwork,
            ...asset,
            source: AssetSource.Custom,
          });
        }
      }

      tx = Object.assign({}, txHalf, {
        gasLimit: gasEstimate?.advanceSetting?.gasLimit,
        ...(gasEstimate?.advanceSetting?.storageLimit ? { storageLimit: gasEstimate?.advanceSetting?.storageLimit } : null),
        ...(gasEstimate?.gasSetting?.suggestedMaxFeePerGas
          ? {
              type: 2,
              maxFeePerGas: gasEstimate?.gasSetting?.suggestedMaxFeePerGas,
              maxPriorityFeePerGas: gasEstimate?.gasSetting?.suggestedMaxPriorityFeePerGas,
            }
          : { gasPrice: gasEstimate?.gasSetting?.suggestedGasPrice, type: 0 }),
      });
      tx.nonce = gasEstimate?.advanceSetting?.nonce;

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
        signature = await methods.createSignature({
          address: currentAddress,
          signType: SignType.TX,
        });
        txHash = await plugins.Transaction.sendRawTransaction({ txRaw, network: currentNetwork });

        setBSIMEvent(null);
        showMessage({
          type: 'success',
          message: t('tx.confirm.submitted.message'),
          description: t('tx.confirm.submitted.description'),
          icon: 'loading' as unknown as undefined,
        });
        backToHome(navigation);
        plugins.AssetsTracker.updateCurrentTracker();
        if (nftItemDetail) {
          plugins.NFTDetailTracker.updateCurrentOpenNFT();
        }
      } catch (error) {
        if (error instanceof BSIMError) {
          setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: error?.message });
        } else {
          // throw error to outer catch
          throw error;
        }
      }
    } catch (_err: any) {
      txError = _err;
      setBSIMEvent(null);
      const err = String(_err.data || _err?.message || _err);
      if (error instanceof SignTransactionCancelError) {
        // ignore cancel error
        return;
      }
      setError({
        message: err,
        ...(err.includes('out of balance') ? { type: 'out of balance' } : err.includes('timed out') ? { type: 'network error' } : null),
      });
      showMessage({
        message: t('tx.confirm.failed'),
        description: err,
        type: 'failed',
      });
    } finally {
      if (txRaw) {
        events.broadcastTransactionSubjectPush.next({
          txHash,
          txRaw,
          tx,
          address: currentAddress,
          signature,
          extraParams: {
            assetType: asset.type,
            contractAddress: asset.type !== AssetType.Native ? asset.contractAddress : undefined,
            to: recipientAddress,
            sendAt: new Date(),
            epochHeight: currentNetwork.networkType === NetworkType.Conflux ? epochHeightRef.current : null,
            err: txError && String(txError.data || txError?.message || txError),
            errorType: txError && processError(txError).errorType,
            method: asset.type === AssetType.ERC721 ? 'transferFrom' : asset.type === AssetType.ERC1155 ? 'safeTransferFrom' : 'transfer',
          },
        });
      }
    }
  }, [gasEstimate, currentVault?.id, currentNetwork?.id]);

  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);
  return (
    <>
      <SendTransactionBottomSheet
        title={t('tx.confirm.title')}
        enablePanDownToClose={!inSending}
        enableContentPanningGesture={!inSending}
        enableHandlePanningGesture={!inSending}
      >
        <BottomSheetScrollContent>
          <Text style={[styles.sendTitle, { color: colors.textPrimary }]}>{t('common.send')}</Text>

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
          <View style={[styles.divider, { backgroundColor: colors.borderFourth }]} />

          <Text style={[styles.signWith, { color: colors.textSecondary }]}>{t('tx.confirm.signingWith')}</Text>
          <AccountItemView nickname={currentAccount?.nickname} addressValue={currentAddressValue} colors={colors}>
            <Text style={[styles.networkName, { color: colors.textSecondary }]} numberOfLines={1}>
              on {currentNetwork?.name}
            </Text>
          </AccountItemView>

          <Text style={[styles.estimateFee, { color: colors.textPrimary }]}>{t('tx.confirm.estimatedFee')}</Text>
          <EstimateFee
            gasSetting={gasEstimate?.gasSetting}
            advanceSetting={gasEstimate?.advanceSetting ?? gasEstimate?.estimateAdvanceSetting}
            onPressSettingIcon={() => setShowGasFeeSetting(true)}
          />

          {error && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderFourth }]} />
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
    marginBottom: 10,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  divider: {
    width: '100%',
    height: 1,
    marginVertical: 24,
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
    marginBottom: 5,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
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

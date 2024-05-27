/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'react-native-flash-message';
import Decimal from 'decimal.js';
import { interval, switchMap, startWith } from 'rxjs';
import { createERC20Contract, createERC721Contract, createERC1155Contract } from '@cfx-kit/dapp-utils/dist/contract';
import { convertCfxToHex } from '@cfx-kit/dapp-utils/dist/address';
import {
  useCurrentNetwork,
  useCurrentNetworkNativeAsset,
  useCurrentAddressValue,
  useCurrentAccount,
  useCurrentAddress,
  useVaultOfAccount,
  AssetType,
  NetworkType,
  VaultType,
  AssetSource,
} from '@core/WalletCore/Plugins/ReactInject';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
import { type ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import { BSIMEventTypesName, BSIMEvent } from '@WalletCoreExtends/Plugins/BSIM/types';
import { BSIMError, BSIM_ERRORS } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import plugins from '@core/WalletCore/Plugins';
import methods from '@core/WalletCore/Methods';
import events from '@core/WalletCore/Events';
import Text from '@components/Text';
import Button from '@components/Button';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { BottomSheetScrollView, type BottomSheetMethods } from '@components/BottomSheet';
import { getDetailSymbol } from '@modules/AssetsList/NFTsList/NFTItem';
import { AccountItemView } from '@modules/AccountsList';
import useFormatBalance from '@hooks/useFormatBalance';
import useInAsync from '@hooks/useInAsync';
import backToHome from '@utils/backToHome';
import { SendTransactionStep4StackName, type SendTransactionScreenProps } from '@router/configs';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import { NFT } from '../Step3Amount';
import BSIMVerify from '../BSIMVerify';
import WarnIcon from '@assets/icons/warn.svg';
import ProhibitIcon from '@assets/icons/prohibit.svg';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import { useGasEstimate } from '@hooks/useGasEstimate';
import { useSignTransaction } from '@hooks/useSignTransaction';
import { processError } from '@core/utils/eth';

const SendTransactionStep4Confirm: React.FC<SendTransactionScreenProps<typeof SendTransactionStep4StackName>> = ({ navigation, route }) => {
  useEffect(() => Keyboard.dismiss(), []);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const BSIMVerifyRef = useRef<BottomSheetMethods>(null!);

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

  const formattedAmount = useFormatBalance(amount);
  // const price = useMemo(() => new Decimal(asset.priceInUSDT || 0).mul(new Decimal(txAmount || 0)).toFixed(2), []);

  const price = useMemo(() => calculateTokenPrice({ price: asset.priceInUSDT, amount: amount }), [asset.priceInUSDT, amount]);
  const symbol = useMemo(() => {
    if (!nftItemDetail) {
      return asset.symbol;
    } else return getDetailSymbol(nftItemDetail);
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
      // eSpace only support legacy transaction by now
      type: plugins.Transaction.isOnlyLegacyTxSupport(currentNetwork.chainId) ? 0 : undefined,
    } as ITxEvm;
  }, []);

  // const [gasInfo, setGasInfo] = useState<Awaited<ReturnType<typeof plugins.Transaction.estimate>> | null>(null);

  const gasInfo = useGasEstimate(txHalf);

  const gasCostAndPriceInUSDT = useMemo(() => {
    if (!gasInfo || !nativeAsset?.priceInUSDT) return null;
    const cost = new Decimal(gasInfo.gasLimit).mul(new Decimal(gasInfo.gasPrice)).div(Decimal.pow(10, nativeAsset?.decimals ?? 18));
    const priceInUSDT = nativeAsset?.priceInUSDT ? cost.mul(new Decimal(nativeAsset.priceInUSDT)) : null;
    return {
      cost: cost.toString(),
      priceInUSDT: priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null,
    };
  }, [gasInfo, nativeAsset?.priceInUSDT]);

  const [error, setError] = useState<{ type?: string; message: string } | null>(null);

  const [bsimEvent, setBSIMEvent] = useState<BSIMEvent | null>(null);
  const bsimCancelRef = useRef<VoidFunction>(() => {});
  const epochHeightRef = useRef('');
  const _handleSend = useCallback(async () => {
    setBSIMEvent(null);
    bsimCancelRef.current?.();

    let txRaw!: string;
    let txHash!: string;
    let tx!: ITxEvm & {
      storageLimit?: string | undefined;
      gasLimit: string | undefined;
      gasPrice: string | undefined;
    };
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
        gasLimit: gasInfo?.gasLimit,
        gasPrice: gasInfo?.gasPrice,
        ...(currentNetwork.networkType === NetworkType.Conflux ? { storageLimit: gasInfo?.storageLimit } : null),
      });
      const nonce = await plugins.Transaction.getTransactionCount({ network: currentNetwork, addressValue: currentAddressValue });
      tx.nonce = Number(nonce);

      if (currentNetwork.networkType === NetworkType.Conflux) {
        const currentEpochHeight = await plugins.BlockNumberTracker.getNetworkBlockNumber(currentNetwork);
        if (!epochHeightRef.current || !checkDiffInRange(BigInt(currentEpochHeight) - BigInt(epochHeightRef.current))) {
          epochHeightRef.current = currentEpochHeight;
        }
      }

      try {
        if (currentVault?.type === VaultType.BSIM) {
          setBSIMEvent({ type: BSIMEventTypesName.BSIM_SIGN_START });
        }

        const { txRawPromise, cancel } = await signTransaction({ ...tx, epochHeight: epochHeightRef.current });
        bsimCancelRef.current = cancel;
        txRaw = await txRawPromise;

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
          if (error.code === 'cancel') {
            // ignore cancel error
          } else {
            setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: error.message });
          }
        }
        // throw error to outer catch
        throw error;
      }
    } catch (_err: any) {
      txError = _err;
      setBSIMEvent(null);
      const err = String(_err.data || _err?.message || _err);
      if (err.includes('cancel')) {
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
          extraParams: {
            assetType: asset.type,
            contractAddress: asset.type !== AssetType.Native ? asset.contractAddress : undefined,
            to: recipientAddress,
            sendAt: new Date(),
            epochHeight: currentNetwork.networkType === NetworkType.Conflux ? epochHeightRef.current : null,
            err: txError && String(txError.data || txError?.message || txError),
            errorType: txError && processError(txError).errorType,
          },
        });
      }
    }
  }, [gasInfo, currentVault?.id, currentNetwork?.id]);

  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);

  return (
    <>
      <SendTransactionBottomSheet
        showTitle={t('tx.confirm.title')}
        enablePanDownToClose={!inSending}
        enableContentPanningGesture={!inSending}
        enableHandlePanningGesture={!inSending}
      >
        <BottomSheetScrollView>
          <Text style={[styles.sendTitle, { color: colors.textPrimary }]}>{t('common.send')}</Text>
          {nftItemDetail && <NFT colors={colors} asset={asset} nftItemDetail={nftItemDetail} />}
          {asset.type !== AssetType.ERC721 && (
            <>
              <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>{t('common.amount')}</Text>
              <View style={styles.balanceWrapper}>
                <Text style={[styles.balance, { color: colors.textPrimary }]} numberOfLines={1}>
                  {nftItemDetail ? amount : formattedAmount} {symbol}
                </Text>
                {(asset.type === AssetType.Native || asset.type === AssetType.ERC20) && <TokenIcon style={styles.assetIcon} source={asset.icon} />}
              </View>
              {price && <Text style={[styles.text, styles.price, { color: colors.textSecondary }]}>≈${price}</Text>}
            </>
          )}

          <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>{t('common.to')}</Text>
          <AccountItemView nickname={''} addressValue={recipientAddress} colors={colors} />

          <View style={[styles.divider, { backgroundColor: colors.borderFourth }]} />

          <AccountItemView nickname={t('tx.confirm.signingWith')} addressValue={currentAddressValue} colors={colors}>
            <Text style={[styles.networkName, { color: colors.textSecondary }]} numberOfLines={1}>
              on {currentNetwork?.name}
            </Text>
          </AccountItemView>

          <Text style={[styles.estimateFee, { color: colors.textPrimary }]}>{t('tx.confirm.estimatedFee')}</Text>
          <View style={styles.estimateWrapper}>
            <TokenIcon style={styles.assetIcon} source={nativeAsset?.icon} />
            {gasCostAndPriceInUSDT && (
              <>
                <Text style={[styles.gasText, { color: colors.textSecondary }]}>
                  {'  '}
                  {gasCostAndPriceInUSDT.cost} {nativeAsset?.symbol}
                </Text>
                {gasCostAndPriceInUSDT.priceInUSDT && (
                  <Text style={[styles.gasText, { color: colors.textSecondary }]}>
                    {'    '}
                    {gasCostAndPriceInUSDT.priceInUSDT}
                  </Text>
                )}
              </>
            )}
          </View>

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
            <Button testID="send" style={styles.btn} size="small" disabled={!gasInfo} onPress={handleSend} loading={inSending}>
              {error ? t('common.retry') : t('common.send')}
            </Button>
          </View>
        </BottomSheetScrollView>
      </SendTransactionBottomSheet>
      {bsimEvent && (
        <BSIMVerify
          bottomSheetRef={BSIMVerifyRef}
          bsimEvent={bsimEvent}
          onClose={() => {
            setBSIMEvent(null);
            bsimCancelRef.current?.();
          }}
          onRetry={handleSend}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  sendTitle: {
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  text: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  to: {
    marginTop: 32,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  amount: {
    marginTop: 22,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  textInput: {
    marginHorizontal: 16,
    paddingRight: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  balanceWrapper: {
    marginTop: 14,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 24,
  },
  balance: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  price: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  assetIcon: {
    width: 24,
    height: 24,
    borderRadius: 48,
  },
  divider: {
    width: '100%',
    height: 1,
    marginVertical: 24,
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
  estimateWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 56,
  },
  gasText: {
    fontSize: 12,
    fontWeight: '300',
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
    marginBottom: 32,
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

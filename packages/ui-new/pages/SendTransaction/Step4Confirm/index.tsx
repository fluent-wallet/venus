/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { useTheme, CommonActions } from '@react-navigation/native';
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
import { BSIM_ERRORS } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';
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
import { SendTransactionStep4StackName, HomeStackName, type SendTransactionScreenProps } from '@router/configs';
import BackupBottomSheet from '../SendTransactionBottomSheet';
import { NFT } from '../Step3Amount';
import BSIMVerify from '../BSIMVerify';

const SendTransactionStep4Confirm: React.FC<SendTransactionScreenProps<typeof SendTransactionStep4StackName>> = ({ navigation, route }) => {
  useEffect(() => Keyboard.dismiss(), []);
  const { colors, mode } = useTheme();
  const BSIMVerifyRef = useRef<BottomSheetMethods>(null!);

  const currentNetwork = useCurrentNetwork()!;
  const nativeAsset = useCurrentNetworkNativeAsset()!;
  const currentAddress = useCurrentAddress()!;
  const currentAddressValue = useCurrentAddressValue()!;
  const currentAccount = useCurrentAccount();
  const currentVault = useVaultOfAccount(currentAccount?.id);

  const formatedAmount = useFormatBalance(route.params.amount);
  const price = useMemo(() => new Decimal(route.params.asset.priceInUSDT || 0).mul(new Decimal(route.params.amount || 0)).toFixed(2), []);
  const symbol = useMemo(() => {
    if (!route.params.nftItemDetail) {
      return route.params.asset.symbol;
    } else return getDetailSymbol(route.params.nftItemDetail);
  }, []);

  const transferAmountHex = useMemo(
    () => new Decimal(route.params.amount || 0).mul(Decimal.pow(10, route.params.nftItemDetail ? 0 : route.params.asset.decimals || 0)).toHex(),
    [],
  );

  const txHalf = useMemo(() => {
    let data = '0x';
    if (route.params.asset.type === AssetType.ERC20) {
      const contract = createERC20Contract(route.params.asset.contractAddress!);
      data = contract.encodeFunctionData('transfer', [
        (currentNetwork.networkType === NetworkType.Conflux ? convertCfxToHex(route.params.targetAddress) : route.params.targetAddress) as `0x${string}`,
        transferAmountHex as unknown as bigint,
      ]);
    } else if (route.params.asset.type === AssetType.ERC721) {
      const contract = createERC721Contract(route.params.asset.contractAddress!);
      data = contract.encodeFunctionData('transferFrom', [
        currentAddressValue as `0x${string}`,
        route.params.targetAddress as `0x${string}`,
        route.params.nftItemDetail?.tokenId as unknown as bigint,
      ]);
    } else if (route.params.asset.type === AssetType.ERC1155) {
      const contract = createERC1155Contract(route.params.asset.contractAddress!);
      data = contract.encodeFunctionData('safeTransferFrom', [
        currentAddressValue as `0x${string}`,
        route.params.targetAddress as `0x${string}`,
        route.params.nftItemDetail?.tokenId as unknown as bigint,
        transferAmountHex as unknown as bigint,
        '0x',
      ]);
    }

    return {
      to: route.params.asset.type === AssetType.Native ? route.params.targetAddress : route.params.asset.contractAddress,
      value: route.params.asset.type === AssetType.Native ? transferAmountHex : '0x0',
      data,
      from: currentAddressValue,
      chainId: currentNetwork.chainId,
      // eSpace only support legacy transaction by now
      ...(currentNetwork.networkType === NetworkType.Ethereum &&
      (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
        ? { type: 0 }
        : null),
    } as ITxEvm;
  }, []);

  const [gasInfo, setGasInfo] = useState<Awaited<ReturnType<typeof plugins.Transaction.estimate>> | null>(null);
  const gasCostAndPriceInUSDT = useMemo(() => {
    if (!gasInfo || !nativeAsset?.priceInUSDT) return null;
    const cost = new Decimal(gasInfo.gasLimit).mul(new Decimal(gasInfo.gasPrice)).div(Decimal.pow(10, nativeAsset?.decimals ?? 18));
    const priceInUSDT = nativeAsset?.priceInUSDT ? cost.mul(new Decimal(nativeAsset.priceInUSDT)) : null;
    return {
      cost: cost.toString(),
      priceInUSDT: priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null,
    };
  }, [gasInfo, nativeAsset?.priceInUSDT]);

  useEffect(() => {
    const pollingGasSub = interval(15000)
      .pipe(
        startWith(0),
        switchMap(() =>
          plugins.Transaction.estimate({
            tx: txHalf,
            network: currentNetwork,
          }),
        ),
      )
      .subscribe({
        next: (res) => {
          setGasInfo(res);
        },
        error: (err) => {
          console.error('estimate gas error: ', err);
        },
      });

    return () => {
      pollingGasSub.unsubscribe();
    };
  }, []);

  const [bsimEvent, setBSIMEvent] = useState<BSIMEvent | null>(null);
  const bsimCancelRef = useRef<VoidFunction>(() => {});
  const _handleSend = useCallback(async () => {
    setBSIMEvent(null);
    bsimCancelRef.current?.();

    try {
      if (route.params.asset.type === AssetType.ERC20 && route.params.asset.contractAddress) {
        const isInDB = await currentNetwork.queryAssetByAddress(route.params.asset.contractAddress);
        if (!isInDB) {
          await methods.createAsset({
            network: currentNetwork,
            ...route.params.asset,
            source: AssetSource.Custom,
          });
        }
      }
      const tx = Object.assign({}, txHalf, {
        gasLimit: gasInfo?.gasLimit,
        gasPrice: gasInfo?.gasPrice,
        ...(currentNetwork.networkType === NetworkType.Conflux ? { storageLimit: gasInfo?.storageLimit } : null),
      });
      const nonce = await plugins.Transaction.getTransactionCount({ network: currentNetwork, addressValue: currentAddressValue });
      tx.nonce = nonce;
      const blockNumber = await plugins.Transaction.getBlockNumber(currentNetwork);

      let txRaw!: string;
      if (currentVault?.type === VaultType.BSIM) {
        try {
          setBSIMEvent({ type: BSIMEventTypesName.BSIM_SIGN_START });
          // sendTransaction has from field, but it is readonly, and it is only have by tx is signed otherwise it is null, so we need to pass the from address to signTransaction
          const [txRawPromise, cancel] = await plugins.BSIM.signTransaction(currentAddressValue, tx);
          bsimCancelRef.current = cancel;
          txRaw = await txRawPromise;
        } catch (bsimError) {
          const code = (bsimError as { code: string })?.code;
          const message = (bsimError as { message: string })?.message;
          if (code) {
            if (code === 'cancel') {
              setBSIMEvent(null);
            } else {
              const errorMsg = BSIM_ERRORS[code?.toUpperCase()];
              if (errorMsg) {
                setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: errorMsg });
              } else {
                setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: message || BSIM_ERRORS.default });
              }
            }
          } else {
            setBSIMEvent({ type: BSIMEventTypesName.ERROR, message: message || BSIM_ERRORS.default });
          }
          bsimCancelRef.current = () => {};
        }
      } else {
        const privateKey = await methods.getPrivateKeyOfAddress(currentAddress);
        txRaw = await plugins.Transaction.signTransaction({ network: currentNetwork, tx, privateKey, blockNumber });
      }

      if (txRaw) {
        const txHash = await plugins.Transaction.sendRawTransaction({ txRaw, network: currentNetwork });
        events.broadcastTransactionSubjectPush.next({
          txHash,
          txRaw,
          tx,
          extraParams: {
            assetType: route.params.asset.type,
            contractAddress: route.params.asset.contractAddress,
            to: route.params.targetAddress,
            sendAt: new Date(),
          },
        });
        showMessage({
          type: 'success',
          message: 'Transaction Submitted',
          description: 'Waiting for execution',
          icon: 'loading' as unknown as undefined,
        });
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
        plugins.AssetsTracker.updateCurrentTracker();
        if (route.params.nftItemDetail) {
          plugins.NFTDetailTracker.updateCurrentOpenNFT();
        }
      }
    } catch (err: any) {
      if (String(err)?.includes('cancel')) {
        return;
      }
      console.log(err);
      showMessage({
        message: 'Transaction Failed',
        description: String(err.data || err?.message || err),
        type: 'failed',
      });
    }
  }, [gasInfo, currentVault?.id, currentNetwork?.id]);

  const { inAsync: inSending, execAsync: handleSend } = useInAsync(_handleSend);

  return (
    <>
      <BackupBottomSheet showTitle="Transaction Confirm">
        <BottomSheetScrollView>
          <Text style={[styles.sendTitle, { color: colors.textPrimary }]}>↗️ Send</Text>
          {route.params.nftItemDetail && <NFT colors={colors} asset={route.params.asset} nftItemDetail={route.params.nftItemDetail} />}
          {route.params.asset.type !== AssetType.ERC721 && (
            <>
              <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>Amount</Text>
              <View style={styles.balanceWrapper}>
                <Text style={[styles.balance, { color: colors.textPrimary }]} numberOfLines={1}>
                  {route.params.nftItemDetail ? route.params.amount : formatedAmount} {symbol}
                </Text>
                {(route.params.asset.type === AssetType.Native || route.params.asset.type === AssetType.ERC20) && (
                  <TokenIcon style={styles.assetIcon} source={route.params.asset.icon} />
                )}
              </View>
              {route.params.asset.priceInUSDT && price && <Text style={[styles.text, styles.price, { color: colors.textSecondary }]}>≈${price}</Text>}
            </>
          )}

          <Text style={[styles.text, styles.to, { color: colors.textSecondary }]}>To</Text>
          <AccountItemView nickname={''} addressValue={route.params.targetAddress} colors={colors} mode={mode} />

          <View style={[styles.divider, { backgroundColor: colors.borderFourth }]} />

          <AccountItemView nickname="Signing with" addressValue={currentAddressValue} colors={colors} mode={mode}>
            <Text style={[styles.networkName, { color: colors.textSecondary }]} numberOfLines={1}>
              on {currentNetwork?.name}
            </Text>
          </AccountItemView>

          <Text style={[styles.estimateFee, { color: colors.textPrimary }]}>Estimated Fee</Text>
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

          <View style={styles.btnArea}>
            <Button
              testID="cancel"
              style={styles.btn}
              size="small"
              onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }))}
              disabled={inSending}
            >
              Cancel
            </Button>
            <Button testID="send" style={styles.btn} size="small" disabled={!gasInfo} onPress={handleSend} loading={inSending}>
              Send
            </Button>
          </View>
        </BottomSheetScrollView>
      </BackupBottomSheet>
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
  textinput: {
    marginHorizontal: 16,
    paddingRight: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  balanceWrapper: {
    marginTop: 14,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 24,
  },
  balance: {
    fontSize: 16,
    fontWeight: '600',
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
    marginLeft: 'auto',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  estimateFee: {
    marginTop: 16,
    marginBottom: 2,
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
  btnArea: {
    marginTop: 40,
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

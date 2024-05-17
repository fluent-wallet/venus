import BottomSheet, { BottomSheetView, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Icon from '@components/Icon';
import {
  AssetType,
  NetworkType,
  VaultType,
  useCurrentAccount,
  useCurrentAddressOfAccount,
  useCurrentNetwork,
  useCurrentNetworkNativeAsset,
  useVaultOfAccount,
} from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import { numberWithCommas } from '@core/utils/balance';
import { RouteProp, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import { WalletConnectParamList, WalletConnectTransactionStackName } from '@router/configs';
import { toDataUrl } from '@utils/blockies';
import { formatEther } from 'ethers';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Text from '@components/Text';

import { showMessage } from 'react-native-flash-message';
import { interval, startWith, switchMap } from 'rxjs';
import Plugins from '@core/WalletCore/Plugins';
import Decimal from 'decimal.js';
import useInAsync from '@hooks/useInAsync';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import Methods from '@core/WalletCore/Methods';
import Events from '@core/WalletCore/Events';

import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/utils/consts';
import SendNativeToken from './nativeToken';
import { calculateTokenPrice } from '@utils/calculateTokenPrice';
import { useGasEstimate } from '@hooks/useGasEstimate';
import { useSignTransaction } from '@hooks/useSignTransaction';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import { BSIMError } from '@WalletCoreExtends/Plugins/BSIM/BSIMSDK';

function WalletConnectTransaction() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentNativeToken = useCurrentNetworkNativeAsset();
  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddressOfAccount(currentAccount?.id)!;
  const currentNetwork = useCurrentNetwork()!;
  const [rpcGasPrice, setRpcGasPrice] = useState<string>();

  const signTransaction = useSignTransaction();

  const epochHeightRef = useRef('');
  const vault = useVaultOfAccount(currentAccount?.id);
  const navigation = useNavigation();
  const {
    params: {
      reject,
      approve,
      tx: { from, to, value, data, nonce, gasLimit, gasPrice },
      isContract,
    },
  } = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectTransactionStackName>>();
  const gasInfo = useGasEstimate({ from, to, value: value.toString(), data, nonce });

  const amount = useMemo(() => {
    return value ? formatEther(BigInt(value)) : '0';
  }, [value]);

  const price = useMemo(() => calculateTokenPrice({ price: currentNativeToken?.priceInUSDT, amount }), [currentNativeToken?.priceInUSDT, amount]);

  const _handleReject = useCallback(async () => {
    await reject('user reject');
    navigation.goBack();
  }, [reject, navigation]);

  const _handleApprove = useCallback(async () => {
    if (!gasInfo) return;

    try {
      const tx = {
        from: currentAddress?.hex,
        to,
        value: value ? value : '0x0',
        data: data || '0x',
        chainId: currentNetwork.chainId,
        ...(currentNetwork.networkType === NetworkType.Ethereum &&
        (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
          ? { type: 0 }
          : null),
      } as ITxEvm;

      const nonce = await Plugins.Transaction.getTransactionCount({ network: currentNetwork, addressValue: currentAddress.hex });
      tx.nonce = Number(nonce);
      tx.gasLimit = gasLimit ? gasLimit.toString() : gasInfo?.gasLimit;
      tx.gasPrice = gasPrice ? gasPrice.toString() : gasInfo?.gasPrice;

      if (currentNetwork.networkType === NetworkType.Conflux) {
        const currentEpochHeight = await Plugins.BlockNumberTracker.getNetworkBlockNumber(currentNetwork);
        if (!epochHeightRef.current || !checkDiffInRange(BigInt(currentEpochHeight) - BigInt(epochHeightRef.current))) {
          epochHeightRef.current = currentEpochHeight;
        }
      }

      try {
        const { txRawPromise, cancel } = await signTransaction({ ...tx, epochHeight: epochHeightRef.current });

        const txRaw = await txRawPromise;

        const txHash = await Plugins.Transaction.sendRawTransaction({ txRaw, network: currentNetwork });

        Events.broadcastTransactionSubjectPush.next({
          txHash,
          txRaw,
          tx,
          extraParams: {
            assetType: isContract ? AssetType.ERC20 : AssetType.Native, // TODO update the assetType
            contractAddress: isContract ? to : undefined,
            to: to,
            sendAt: new Date(),
            epochHeight: currentNetwork.networkType === NetworkType.Conflux ? epochHeightRef.current : null,
          },
        });

        showMessage({
          type: 'success',
          message: t('tx.confirm.submitted.message'),
          description: t('tx.confirm.submitted.description'),
          icon: 'loading' as unknown as undefined,
        });
        Plugins.AssetsTracker.updateCurrentTracker();
        await approve(txHash);
        navigation.goBack();
      } catch (error) {
        if (error instanceof BSIMError) {
          if (error.code === 'cancel') {
            // ignore cancel error
          } else {
            // TODO
          }
        }
        // not BSIM error
        throw error;
      }
    } catch (error) {
      // TODO show error
    }
  }, [approve, currentAddress, currentNetwork, data, gasLimit, gasPrice, t, to, navigation, value, gasInfo, isContract, signTransaction]);

  const gasCost = useMemo(() => {
    // if dapp not give gasPrice and rpcGasPrice is null, just return null
    const gasPriceVal = gasPrice || rpcGasPrice;
    const gasLimitVal = gasLimit || gasInfo?.gasLimit;
    if (!gasPriceVal || !gasLimitVal) return null;

    if (!currentNativeToken?.priceInUSDT) return null;

    const cost = new Decimal(gasLimitVal.toString()).mul(new Decimal(gasPriceVal.toString())).div(Decimal.pow(10, currentNativeToken?.decimals ?? 18));
    const priceInUSDT = currentNativeToken?.priceInUSDT ? cost.mul(new Decimal(currentNativeToken.priceInUSDT)) : null;

    return priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null;
  }, [gasPrice, rpcGasPrice, currentNativeToken?.priceInUSDT, currentNativeToken?.decimals, gasLimit, gasInfo?.gasLimit]);

  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);
  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);

  return (
    <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent75} style={styles.container}>
      <BottomSheetView>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('wc.dapp.tx.title')}</Text>
        {isContract ? (
          <View></View>
        ) : (
          <SendNativeToken amount={value.toString()} price={price ? price.toString() : ''} tokenIcon={currentNativeToken?.icon} receiverAddress={to} />
        )}

        <View style={[styles.signingWith, { borderColor: colors.borderFourth }]}>
          <Text style={[styles.secondary, { color: colors.textSecondary }]}>{t('wc.dapp.tx.signingWith')}</Text>
        </View>

        <View style={[styles.flexWithRow, styles.sender]}>
          <View style={[styles.flexWithRow, styles.addressInfo, { alignItems: 'flex-start' }]}>
            <Image source={{ uri: toDataUrl(currentAddress?.hex) }} style={styles.avatar} />
            <View>
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.senderName, { color: colors.textPrimary }]}>{currentAccount?.nickname}</Text>
                <Text style={[styles.smallText, { color: colors.textSecondary }]}>{shortenAddress(currentAddress?.hex)}</Text>
              </View>

              <View>
                <Text>{t('tx.confirm.estimatedFee')}</Text>
                <View style={[styles.flexWithRow, { marginTop: 8 }]}>
                  {currentNativeToken?.icon && <Icon source={currentNativeToken?.icon} width={24} height={24} />}
                  <Text style={[styles.gas, { color: colors.textPrimary }]}>{gasCost}</Text>
                </View>
              </View>
            </View>
          </View>
          <Text style={styles.smallText}>{t('wc.sign.network', { network: currentNetwork?.name })}</Text>
        </View>

        <View style={[styles.flexWithRow, styles.buttons]}>
          <Button testID="reject" onPress={handleReject} style={styles.btn} loading={rejectLoading}>
            {t('common.cancel')}
          </Button>
          <Button testID="approve" style={styles.btn} onPress={handleApprove} loading={approveLoading}>
            {t('common.confirm')}
          </Button>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 10,
  },

  secondary: {
    fontSize: 14,
    fontWeight: '300',
  },

  signingWith: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  smallText: {
    fontSize: 12,
    fontWeight: '300',
  },
  sender: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
  },
  gas: {
    fontSize: 16,
    fontWeight: '600',
  },
  flexWithRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressInfo: {
    gap: 8,
  },
  buttons: {
    gap: 16,
    marginTop: 22,
  },
  btn: {
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});

export default WalletConnectTransaction;

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
import { WalletConnectEOATransactionStackName, WalletConnectParamList } from '@router/configs';
import { toDataUrl } from '@utils/blockies';
import { formatEther, parseEther } from 'ethers';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Text from '@components/Text';
import Copy from '@assets/icons/copy.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import { showMessage } from 'react-native-flash-message';
import { interval, startWith, switchMap } from 'rxjs';
import Plugins from '@core/WalletCore/Plugins';
import Decimal from 'decimal.js';
import useInAsync from '@hooks/useInAsync';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import Methods from '@core/WalletCore/Methods';
import Events from '@core/WalletCore/Events';
import backToHome from '@utils/backToHome';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/utils/consts';

function WalletConnectTransaction() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentNativeToken = useCurrentNetworkNativeAsset();
  const currentAccount = useCurrentAccount();
  const currentAddress = useCurrentAddressOfAccount(currentAccount?.id)!;
  const currentNetwork = useCurrentNetwork()!;
  const [rpcGasPrice, setRpcGasPrice] = useState<string>();
  const vault = useVaultOfAccount(currentAccount?.id);
  const navigation = useNavigation();
  const {
    params: {
      reject,
      approve,
      tx: { from, to, value, data, nonce, gasLimit, gasPrice },
    },
  } = useRoute<RouteProp<WalletConnectParamList, typeof WalletConnectEOATransactionStackName>>();

  const price = useMemo(
    () => (currentNativeToken?.priceInUSDT ? `$${numberWithCommas(currentNativeToken?.priceInUSDT)}` : '--'),
    [currentNativeToken?.priceInUSDT],
  );

  const amount = useMemo(() => {
    return value ? parseEther(BigInt(value).toString()).toString() : '0';
  }, [value]);

  const _handleReject = useCallback(async () => {
    await reject('user reject');
  }, [reject]);

  const _handleApprove = useCallback(async () => {
    if (!gasPrice && !rpcGasPrice) {
      return;
    }

    const tx = {
      from: currentAddress?.hex,
      to,
      value: value ? parseEther(amount).toString() : '0x0',
      data: data || '0x',
      chainId: currentNetwork.chainId,
      ...(currentNetwork.networkType === NetworkType.Ethereum &&
      (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
        ? { type: 0 }
        : null),
    } as ITxEvm;

    const nonce = await Plugins.Transaction.getTransactionCount({ network: currentNetwork, addressValue: currentAddress.hex });
    tx.nonce = Number(nonce);
    tx.gasLimit = gasLimit || '21000';
    tx.gasPrice = gasPrice || rpcGasPrice;

    let txRaw!: string;
    if (vault?.type === VaultType.BSIM) {
      try {
        console.log(tx);
        const [promise] = await Plugins.BSIM.signTransaction(currentAddress.hex, tx);
        txRaw = await promise;
        console.log('txRaw', txRaw);
      } catch (e) {
        // TODO
        console.log(e);
      }
    } else {
      const privateKey = await Methods.getPrivateKeyOfAddress(currentAddress);

      txRaw = await Plugins.Transaction.signTransaction({
        network: currentNetwork,
        tx,
        privateKey,
        blockNumber: currentNetwork.networkType === NetworkType.Conflux ? await Plugins.BlockNumberTracker.getNetworkBlockNumber(currentNetwork) : '',
      });
    }

    if (txRaw) {
      const txHash = await Plugins.Transaction.sendRawTransaction({ txRaw, network: currentNetwork });
      Events.broadcastTransactionSubjectPush.next({
        txHash,
        txRaw,
        tx,
        extraParams: {
          assetType: AssetType.Native,
          to: to,
          sendAt: new Date(),
        },
      });

      showMessage({
        type: 'success',
        message: t('tx.confirm.submitted.message'),
        description: t('tx.confirm.submitted.description'),
        icon: 'loading' as unknown as undefined,
      });
      backToHome(navigation);
      Plugins.AssetsTracker.updateCurrentTracker();
    }

   await approve(txRaw);
  }, [approve, amount, currentAddress, currentNetwork, data, gasLimit, gasPrice, rpcGasPrice, t, to, vault?.type, navigation, value]);

  const gasCost = useMemo(() => {
    // if dapp not give gasPrice and rpcGasPrice is null, just return null
    const gasPriceVal = gasPrice || rpcGasPrice;
    const gasLimitVal = gasLimit || '21000';
    if (!gasPriceVal) return null;

    if (!currentNativeToken?.priceInUSDT) return null;

    const cost = new Decimal(gasLimitVal).mul(new Decimal(gasPriceVal)).div(Decimal.pow(10, currentNativeToken?.decimals ?? 18));
    const priceInUSDT = currentNativeToken?.priceInUSDT ? cost.mul(new Decimal(currentNativeToken.priceInUSDT)) : null;

    return priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null;
  }, [gasPrice, rpcGasPrice, currentNativeToken?.priceInUSDT, currentNativeToken?.decimals, gasLimit]);

  const handleCoy = useCallback(
    (value: string) => {
      Clipboard.setString(value);
      showMessage({
        message: t('common.copied'),
        type: 'success',
        duration: 1500,
        width: 160,
      });
    },
    [t],
  );

  useEffect(() => {
    if (!gasPrice) {
      const pollingGasSub = interval(15000)
        .pipe(
          startWith(0),
          switchMap(() => Plugins.Transaction.getGasPrice(currentNetwork)),
        )
        .subscribe({
          next: (res) => {
            setRpcGasPrice(res);
          },
          error: (err) => {
            console.error('estimate gas error: ', err);
          },
        });

      return () => {
        pollingGasSub.unsubscribe();
      };
    }
  }, [currentNetwork, gasPrice]);

  const { inAsync: rejectLoading, execAsync: handleReject } = useInAsync(_handleReject);
  const { inAsync: approveLoading, execAsync: handleApprove } = useInAsync(_handleApprove);

  return (
    <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent75} style={styles.container}>
      <BottomSheetView>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('wc.dapp.tx.title')}</Text>

        <Text style={[styles.send, { color: colors.textPrimary }]}>{t('common.send')}</Text>
        <Text style={[styles.secondary]}>{t('common.amount')}</Text>

        <View style={[styles.flexWithRow, { marginTop: 8 }]}>
          <Text style={styles.amount}>{amount}</Text>
          {currentNativeToken?.icon && <Icon source={currentNativeToken?.icon} width={24} height={24} />}
        </View>
        <Text style={[styles.secondary, styles.secondary, { color: colors.textSecondary }]}>≈{price}</Text>

        <Text style={[styles.to, { color: colors.textSecondary }]}>{t('common.to')}</Text>

        <View style={[styles.flexWithRow, styles.addressInfo]}>
          <Image source={{ uri: toDataUrl(to) }} style={styles.avatar} />
          <View style={styles.flexWithRow}>
            <Text style={[styles.smallText, { color: colors.textSecondary }]}>{shortenAddress(to)}</Text>
            <Copy width={12} height={12} color={colors.textSecondary} testID="copy" onPress={() => handleCoy(to)} />
          </View>
        </View>

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
  send: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
  },
  secondary: {
    fontSize: 14,
    fontWeight: '300',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  to: {
    marginTop: 24,
    marginBottom: 16,
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

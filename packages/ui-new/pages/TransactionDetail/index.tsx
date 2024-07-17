import Text from '@components/Text';
import { useAssetOfTx, useNativeAssetOfNetwork, usePayloadOfTx, useTxFromId } from '@core/WalletCore/Plugins/ReactInject';
import type { Tx } from '@core/database/models/Tx';
import { formatStatus, formatTxData } from '@core/utils/tx';
import { useTheme } from '@react-navigation/native';
import type { StackScreenProps, TransactionDetailStackName } from '@router/configs';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, Pressable, Linking } from 'react-native';
import ProhibitIcon from '@assets/icons/prohibit.svg';
import SuccessIcon from '@assets/icons/success.svg';
import Copy from '@assets/icons/copy.svg';
import Earth from '@assets/icons/earth.svg';
import Spinner from '@components/Spinner';
import dayjs from 'dayjs';
import { truncate } from '@cfx-kit/dapp-utils/dist/address';
import { showMessage } from 'react-native-flash-message';
import Clipboard from '@react-native-clipboard/clipboard';
import { shortenAddress } from '@core/utils/address';
import { Image } from 'expo-image';
import { toDataUrl } from '@utils/blockies';
import { useMemo } from 'react';
import Decimal from 'decimal.js';
import SpeedUpButton from '@modules/SpeedUpButton';
import { ACTIVITY_DEV_INFO_FEATURE } from '@utils/features';
import { useNetworkOfTx } from '@core/WalletCore/Plugins/ReactInject/data/useTxs';
import { useShowSpeedUp } from '@hooks/useShowSpeedUp';

const getGasCostFromError = (err: string | null | undefined) => {
  if (!err) {
    return null;
  }
  // "NotEnoughCash { required: 10000000000000000000, got: 0, actual_gas_cost: 0, max_storage_limit_cost: 0 }"
  const notEnoughCashError = /^NotEnoughCash/.test(err);
  return notEnoughCashError ? err.replace(/.+actual_gas_cost:[\s]?([\d.]+)[\s]?[,}].+/g, '$1').trim() : null;
};

const useGasFeeOfTx = (tx: Tx | null) => {
  const network = useNetworkOfTx(tx?.id ?? '');
  const nativeAsset = useNativeAssetOfNetwork(network?.id);
  const gasCostAndPriceInUSDT = useMemo(() => {
    if (!tx?.receipt) return null;
    const gasPrice = tx.receipt.effectiveGasPrice ?? '0';
    const gasUsed = tx.receipt.gasUsed ?? '0';
    const gasCostInError = getGasCostFromError(tx.err);
    const costInDrip = tx.receipt.gasFee ? new Decimal(tx.receipt.gasFee) : gasCostInError ? new Decimal(gasCostInError) : new Decimal(gasPrice).mul(gasUsed);
    const cost = costInDrip.div(Decimal.pow(10, nativeAsset?.decimals ?? 18));
    const priceInUSDT = nativeAsset?.priceInUSDT ? cost.mul(new Decimal(nativeAsset.priceInUSDT)) : null;

    return {
      value: cost.toString(),
      cost: `${cost.toString()} ${nativeAsset?.symbol}`,
      priceInUSDT: cost.equals(0) ? '$0' : priceInUSDT ? (priceInUSDT.lessThan(0.01) ? '<$0.01' : `≈$${priceInUSDT.toFixed(2)}`) : null,
    };
  }, [tx?.receipt, tx?.err, nativeAsset?.priceInUSDT, nativeAsset?.decimals]);
  return gasCostAndPriceInUSDT;
};

const TxStatus: React.FC<{ tx: Tx }> = ({ tx }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = formatStatus(tx);
  const statusInfo = StatusMap[status];
  return (
    <View style={[styles.statusContainer, { backgroundColor: colors.bgFourth }]}>
      {statusInfo.icon}
      <View style={styles.statusTextContainer}>
        <Text style={[styles.statusText, { color: colors[statusInfo.color] }]}>{t(`tx.detail.status.${statusInfo.text}`)}</Text>
        {status !== 'pending' && <Text style={[styles.time, { color: colors.textSecondary }]}>{dayjs(tx.createdAt).format('MMM DD YYYY, HH:mm')}</Text>}
      </View>
    </View>
  );
};

const TransactionDetail: React.FC<StackScreenProps<typeof TransactionDetailStackName>> = ({ route }) => {
  const { txId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tx = useTxFromId(txId);
  const payload = usePayloadOfTx(txId);
  const asset = useAssetOfTx(txId);
  const status = tx && formatStatus(tx);
  const network = useNetworkOfTx(txId);
  const gasCostAndPriceInUSDT = useGasFeeOfTx(tx);
  const { to } = useMemo(() => formatTxData(tx, payload, asset), [tx, payload, asset]);
  const isPending = status === 'pending';
  const showSpeedUp = useShowSpeedUp(isPending, tx?.createdAt);
  if (!tx) return null;
  const handleCopy = (text: string) => {
    Clipboard.setString(text);
    showMessage({
      message: t('common.copied'),
      type: 'success',
      duration: 1500,
      width: 160,
    });
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.content}>
        <TxStatus tx={tx} />
        <Text style={[styles.functionName, { color: colors.textPrimary }]}>{t('tx.detail.functionName', { name: tx.method })}</Text>
        {showSpeedUp && (
          <>
            <Text style={[styles.action, { color: colors.textSecondary }]}>{t('tx.action.buttonTitle')}</Text>
            <SpeedUpButton txId={txId} containerStyle={styles.speedUp} />
          </>
        )}
      </View>
      <View style={[styles.line, { backgroundColor: colors.borderFourth }]} />
      <View style={[styles.content, styles.detail]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tx.detail.txHash')}</Text>
          <Pressable
            onPress={() => {
              handleCopy(tx.hash ?? '');
            }}
            disabled={!tx.hash}
            testID="hash"
            style={styles.row}
          >
            <Text style={[styles.info, { color: colors.textPrimary }]}>{truncate(tx.hash ?? '', { prefixLength: 6 })}</Text>
            <Copy color={colors.textSecondary} />
          </Pressable>
          {network?.scanUrl && (
            <Pressable
              onPress={() => {
                Linking.openURL(`${network.scanUrl}/tx/${tx.hash}`);
              }}
              disabled={!tx.hash}
              testID="scan"
              style={[{ marginLeft: -4 }]}
            >
              <Earth color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tx.detail.from')}</Text>
          <Pressable
            onPress={() => {
              handleCopy(payload?.from ?? '');
            }}
            disabled={!tx.hash}
            testID="from"
            style={styles.row}
          >
            <Text style={[styles.info, { color: colors.textPrimary }]}>{shortenAddress(payload?.from)}</Text>
            <Copy color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tx.detail.to')}</Text>
          <Pressable
            onPress={() => {
              handleCopy(to ?? '');
            }}
            disabled={!tx.hash}
            testID="to"
            style={styles.row}
          >
            <Text style={[styles.info, { color: colors.textPrimary }]}>{shortenAddress(to)}</Text>
            <Copy color={colors.textSecondary} />
          </Pressable>
        </View>
        {(isPending || gasCostAndPriceInUSDT) && (
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tx.detail.fee')}</Text>
            {!isPending ? (
              gasCostAndPriceInUSDT && (
                <Text style={[styles.info, { color: colors.textPrimary }]}>
                  {gasCostAndPriceInUSDT.cost}
                  {gasCostAndPriceInUSDT.priceInUSDT && ` (${gasCostAndPriceInUSDT.priceInUSDT})`}
                </Text>
              )
            ) : (
              <PendingIcon size="small" />
            )}
          </View>
        )}
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tx.detail.nonce')}</Text>
          <Text style={[styles.info, { color: colors.textPrimary }]}>{payload?.nonce}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tx.detail.network')}</Text>
          <Image style={styles.networkImage} source={{ uri: toDataUrl(network?.chainId) }} />
          <Text style={[styles.info, { color: colors.textPrimary, opacity: network?.name ? 1 : 0 }]}>{network?.name || 'placeholder'}</Text>
        </View>
        {ACTIVITY_DEV_INFO_FEATURE.allow && (
          <>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>status</Text>
              <Text style={[styles.info, { color: colors.textPrimary }]}>{tx.status}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

export const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  statusContainer: {
    padding: 16,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 6,
    marginBottom: 24,
  },
  statusTextContainer: {
    display: 'flex',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    fontWeight: '300',
  },
  statusIcon: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  functionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  action: {
    fontSize: 14,
    fontWeight: '300',
  },
  speedUp: {
    paddingVertical: 16,
  },
  line: {
    height: 1,
    marginTop: 8,
    marginBottom: 24,
  },
  detail: {
    display: 'flex',
    gap: 16,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '300',
    flex: 1,
  },
  info: {
    fontSize: 14,
    fontWeight: '400',
  },
  iconWrapper: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkImage: {
    width: 24,
    height: 24,
    borderRadius: 24,
  },
});

const PendingIcon: React.FC<{ size?: 'default' | 'small' }> = ({ size = 'default' }) => {
  const { colors, mode } = useTheme();
  const iconSize = size === 'default' ? 28 : 16;
  return (
    <View style={size === 'default' ? styles.statusIcon : styles.iconWrapper}>
      <Spinner color={mode === 'dark' ? '#00000080' : '#FFFFFFB2'} backgroundColor={colors.iconPrimary} width={iconSize} height={iconSize} strokeWidth={5} />
    </View>
  );
};

const StatusMap = {
  pending: {
    icon: <PendingIcon />,
    text: 'pending',
    color: 'textPrimary',
  },
  confirmed: {
    icon: <SuccessIcon style={styles.statusIcon} color="#48E6FF" width={40} height={40} />,
    text: 'confirmed',
    color: 'up',
  },
  failed: {
    icon: <ProhibitIcon style={styles.statusIcon} width={40} height={40} />,
    text: 'failed',
    color: 'down',
  },
} as const;

export default TransactionDetail;

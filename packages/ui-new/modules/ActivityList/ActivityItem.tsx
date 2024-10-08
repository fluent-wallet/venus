import Text from '@components/Text';
import { AssetType, useAssetOfTx, usePayloadOfTx } from '@core/WalletCore/Plugins/ReactInject';
import type { Asset } from '@core/database/models/Asset';
import type { Tx } from '@core/database/models/Tx';
import { TxSource } from '@core/database/models/Tx/type';
import { shortenAddress } from '@core/utils/address';
import { maxUint256 } from '@core/utils/number';
import { formatStatus, formatTxData } from '@core/utils/tx';
import useFormatBalance from '@hooks/useFormatBalance';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import SpeedUpButton from '@modules/SpeedUpButton';
import Spinner from '@components/Spinner';
import { useShowSpeedUp } from '@hooks/useShowSpeedUp';
import { useExtraOfTx } from '@core/WalletCore/Plugins/ReactInject/data/useTxs';
import { SpeedUpAction } from '@core/WalletCore/Events/broadcastTransactionSubject';

const TextEllipsisWithSuffix: React.FC<{
  defaultSuffixWidth?: number;
  style?: ViewProps['style'];
  text: JSX.Element;
  suffix?: React.ReactNode;
  suffixStyle?: ViewProps['style'];
}> = ({ style, text, defaultSuffixWidth = 0, suffix, suffixStyle }) => {
  const [suffixWidth, setSuffixWidth] = useState(0);
  const onSuffixLayout = (e: LayoutChangeEvent) => {
    if (suffixWidth) return;
    setSuffixWidth(e.nativeEvent.layout.width);
  };
  useEffect(() => {
    setSuffixWidth(0);
  }, [suffix]);
  return (
    <View style={[styles.textEllipsisWrapper, { paddingRight: suffixWidth || defaultSuffixWidth }, style]}>
      {text}
      {suffix && (
        <View onLayout={onSuffixLayout} style={[suffixStyle, !!suffixWidth && { width: suffixWidth }]}>
          {suffix}
        </View>
      )}
    </View>
  );
};

interface Props extends Omit<ComponentProps<typeof Pressable>, 'onPress'> {
  onPress?: (item: Tx) => void;
  tx: Tx;
}

const AssetInfo: React.FC<{
  asset?: Asset | null;
  value: string | null | undefined;
  tokenId: string;
  method: string;
  txStatus: ReturnType<typeof formatStatus>;
  sign?: '+' | '-';
}> = ({ asset, value, tokenId, txStatus, sign, method }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const decimals = asset?.decimals ?? 0;
  const formatBalance = useFormatBalance(value, decimals);
  const isUnlimited = method === 'approve' && BigInt(value ?? 0) === maxUint256;
  const symbolSuffix = useMemo(() => {
    if (asset || tokenId) {
      return (
        <Text style={[styles.assetText, { color: txStatus === 'failed' ? colors.textSecondary : colors.textPrimary }]} numberOfLines={1}>
          {asset?.symbol}
          {tokenId && <>&nbsp;#{tokenId}</>}
        </Text>
      );
    }
  }, [colors.textSecondary, colors.textPrimary, asset, tokenId, txStatus]);
  return (
    <View style={styles.assetWrapper}>
      {asset?.type === AssetType.ERC20 || asset?.type === AssetType.Native ? (
        <TokenIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 40 }]} />
      ) : (
        <NFTIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 2 }]} />
      )}
      <TextEllipsisWithSuffix
        text={
          <Text style={[styles.assetText, { color: txStatus === 'failed' ? colors.textSecondary : colors.textPrimary }]} numberOfLines={1}>
            {sign}&nbsp;{isUnlimited ? t('common.approve.unlimited') : formatBalance}
          </Text>
        }
        suffix={symbolSuffix}
        defaultSuffixWidth={50}
      />
    </View>
  );
};

const PendingIcon = () => {
  const { colors, mode } = useTheme();
  return <Spinner color={mode === 'dark' ? '#00000080' : '#FFFFFFB2'} backgroundColor={colors.iconPrimary} width={24} height={24} strokeWidth={5} />;
};

const ActivityItem: React.FC<Props> = ({ onPress, tx }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const payload = usePayloadOfTx(tx.id);
  const extra = useExtraOfTx(tx.id);
  const asset = useAssetOfTx(tx.id);
  const status = formatStatus(tx);

  const { value, to, tokenId } = useMemo(() => formatTxData(tx, payload, asset), [tx, payload, asset]);
  const method = useMemo(() => {
    if (tx.source === TxSource.SELF) {
      return t('common.send');
    }
    return tx.method;
  }, [t, tx.method, tx.source]);

  const isPending = status === 'pending';
  const isCanceling = isPending && extra?.sendAction === SpeedUpAction.Cancel;
  const showSpeedUp = useShowSpeedUp(tx);
  const statusSuffix = useMemo(() => {
    if (status === 'pending') {
      return <PendingIcon />;
    }
    if (status === 'failed') {
      return <Text style={[styles.statusText, { color: colors.down, borderColor: colors.down }]}>{t('tx.activity.status.failed')}</Text>;
    }
  }, [status, colors.down, t]);

  return (
    <Pressable
      style={[styles.container, isPending && styles.pendingContainer, isPending && { borderColor: colors.borderFourth }]}
      onPress={() => onPress?.(tx)}
      testID="activityItem"
    >
      {isCanceling && (
        <View style={[styles.canceling, { backgroundColor: colors.borderFourth }]}>
          <Text style={[styles.cancelingText, { color: colors.textPrimary }]}>{t('tx.activity.canceling')}</Text>
        </View>
      )}
      <View style={[styles.content, isCanceling && { paddingTop: 8 }]}>
        <View style={styles.title}>
          <TextEllipsisWithSuffix
            text={
              <Text style={[styles.typeText, { color: colors.textPrimary }]} numberOfLines={1}>
                {method}
              </Text>
            }
            suffix={statusSuffix}
            defaultSuffixWidth={50}
          />
          {to && <Text style={[styles.address, { color: colors.textSecondary }]}>To {shortenAddress(to)}</Text>}
        </View>
        {tx.source === TxSource.SELF && <AssetInfo asset={asset} value={value} tokenId={tokenId} txStatus={status} sign="-" method={method} />}
        {method === 'approve' && <AssetInfo asset={asset} value={value} tokenId={tokenId} txStatus={status} method={method} />}

        {showSpeedUp && <SpeedUpButton txId={tx.id} containerStyle={styles.speedUp} cancelDisabled={isCanceling} />}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  pendingContainer: {
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 24,
  },
  content: {
    padding: 16,
  },
  title: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  statusText: {
    marginLeft: 12,
    fontSize: 12,
    fontWeight: '300',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    transform: [{ translateY: 2 }],
  },
  address: {
    fontSize: 12,
    fontWeight: '300',
    marginLeft: 4,
  },
  assetWrapper: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 20,
    height: 20,
  },
  assetText: {
    fontSize: 12,
    fontWeight: '300',
    marginLeft: 4,
  },
  speedUp: {
    marginTop: 16,
  },
  textEllipsisWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  canceling: {
    padding: 8,
    borderTopRightRadius: 6,
    borderTopLeftRadius: 6,
  },
  cancelingText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '300',
  },
});

export default ActivityItem;

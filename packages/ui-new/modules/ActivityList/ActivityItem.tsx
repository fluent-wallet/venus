import Text from '@components/Text';
import { AssetType, useAssetOfTx, usePayloadOfTx } from '@core/WalletCore/Plugins/ReactInject';
import type { Asset } from '@core/database/models/Asset';
import type { Tx } from '@core/database/models/Tx';
import { TxSource } from '@core/database/models/Tx/type';
import { shortenAddress } from '@core/utils/address';
import { formatStatus, formatTxData } from '@core/utils/tx';
import useFormatBalance from '@hooks/useFormatBalance';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import { useTheme } from '@react-navigation/native';
import { ACTIVITY_DB_STATUS_FEATURE } from '@utils/features';
import type React from 'react';
import { type ComponentProps, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

interface Props extends Omit<ComponentProps<typeof Pressable>, 'onPress'> {
  onPress?: (item: Tx) => void;
  tx: Tx;
}

const AssetInfo: React.FC<{
  asset?: Asset | null;
  value: string | null | undefined;
  tokenId: string;
  txStatus: ReturnType<typeof formatStatus>;
  sign?: '+' | '-' | false;
}> = ({ asset, value, tokenId, txStatus, sign = false }) => {
  const { colors } = useTheme();
  const decimals = asset?.decimals ?? 18;
  const formatBalance = useFormatBalance(value, decimals);
  return (
    <View style={styles.assetWrapper}>
      {asset?.type === AssetType.ERC20 || asset?.type === AssetType.Native ? (
        <TokenIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 40 }]} />
      ) : (
        <NFTIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 2 }]} />
      )}
      <Text style={[styles.assetText, { color: txStatus === 'failed' ? colors.textSecondary : colors.textPrimary }]}>
        {sign} {formatBalance} {asset?.symbol}
        {tokenId && <>&nbsp;#{tokenId}</>}
      </Text>
    </View>
  );
};

const ActivityItem: React.FC<Props> = ({ onPress, tx }) => {
  const { colors } = useTheme();
  const payload = usePayloadOfTx(tx.id);
  const asset = useAssetOfTx(tx.id);
  const status = formatStatus(tx);
  const { value, to, tokenId } = useMemo(() => formatTxData(tx, payload, asset), [tx, payload, asset]);
  const { t } = useTranslation();
  const method = useMemo(() => {
    if (tx.source === TxSource.SELF) {
      return t('common.send');
    }
    return tx.method;
  }, [t, tx.method, tx.source]);

  return (
    <Pressable style={styles.container} onPress={() => onPress?.(tx)}>
      <View style={styles.title}>
        <Text style={[styles.typeText, { color: colors.textPrimary }]} numberOfLines={1}>
          {method}
          {ACTIVITY_DB_STATUS_FEATURE.allow && `  --[${tx.status}-${tx.source}-${tx.method}]`}
        </Text>
        {status !== 'confirmed' && (
          <Text
            style={[styles.statusText, { color: status === 'failed' ? colors.down : colors.up, borderColor: status === 'failed' ? colors.down : colors.up }]}
          >
            {status && t(`tx.activity.status.${status}`)}
          </Text>
        )}

        {to && <Text style={[styles.address, { color: colors.textSecondary }]}>To {shortenAddress(to)}</Text>}
      </View>
      {tx.source === TxSource.SELF && <AssetInfo asset={asset} value={value} tokenId={tokenId} txStatus={status} sign="-" />}
      {method === 'approve' && <AssetInfo asset={asset} value={value} tokenId={tokenId} txStatus={status} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 32,
    paddingRight: 16,
    height: 72,
  },
  title: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
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
  assetTransfer: {},
  assetWrapper: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
  },
  assetText: {
    fontSize: 12,
    fontWeight: '300',
  },
});

export default ActivityItem;

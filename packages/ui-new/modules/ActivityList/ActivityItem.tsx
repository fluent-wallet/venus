import React, { useMemo, type ComponentProps } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { type Tx } from '@core/database/models/Tx';
import { useAssetOfTx, usePayloadOfTx, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import { shortenAddress } from '@core/utils/address';
import Text from '@components/Text';
import { formatStatus, formatTxData } from '@core/utils/tx';
import { ACTIVITY_DB_STATUS_FEATURE } from '@utils/features';
import useFormatBalance from '@hooks/useFormatBalance';
import TokenIcon from '@modules/AssetsList/TokensList/TokenIcon';
import NFTIcon from '@modules/AssetsList/NFTsList/NFTIcon';
import { useTranslation } from 'react-i18next';

interface Props extends Omit<ComponentProps<typeof Pressable>, 'onPress'> {
  onPress?: (item: Tx) => void;
  tx: Tx;
}

const ActivityItem: React.FC<Props> = ({ onPress, tx }) => {
  const { colors } = useTheme();
  const payload = usePayloadOfTx(tx.id);
  const asset = useAssetOfTx(tx.id);
  const status = formatStatus(tx.status);
  const { value, to, decimals, tokenId } = useMemo(() => formatTxData(payload, asset), [payload, asset]);
  const formatBalance = useFormatBalance(value, decimals);
  const { t } = useTranslation();

  return (
    <Pressable style={styles.container} onPress={() => onPress?.(tx)}>
      <View style={styles.title}>
        <Text style={[styles.typeText, { color: colors.textPrimary }]}>
          {t('common.send')}
          {ACTIVITY_DB_STATUS_FEATURE.allow && `  --[${tx.status}]`}
        </Text>
        {status !== 'confirmed' && (
          <Text
            style={[styles.statusText, { color: status === 'failed' ? colors.down : colors.up, borderColor: status === 'failed' ? colors.down : colors.up }]}
          >
            {status && t(`tx.activity.status.${status}`)}
          </Text>
        )}

        <Text style={[styles.address, { color: colors.textSecondary }]}>To {shortenAddress(to)}</Text>
      </View>
      <View style={styles.assetWrapper}>
        {asset?.type === AssetType.ERC20 || asset?.type === AssetType.Native ? (
          <TokenIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 40 }]} />
        ) : (
          <NFTIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 2 }]} />
        )}
        <Text style={[styles.assetText, { color: status === 'failed' ? colors.textSecondary : colors.textPrimary }]}>
          - {formatBalance} {asset?.symbol}
          {tokenId && <>&nbsp;#{tokenId}</>}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 36,
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
    lineHeight: 18
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
    marginLeft: 'auto',
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

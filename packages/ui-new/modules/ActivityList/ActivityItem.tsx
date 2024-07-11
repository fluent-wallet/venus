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
import { type HomeStackName, SpeedUpStackName, type StackScreenProps } from '@router/configs';
import { useTheme, useNavigation } from '@react-navigation/native';
import { ACTIVITY_DB_STATUS_FEATURE, SPEED_UP_FEATURE } from '@utils/features';
import RocketIcon from '@assets/icons/rocket.svg';
import type React from 'react';
import { type ComponentProps, useMemo, useCallback } from 'react';
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
  method: string;
  txStatus: ReturnType<typeof formatStatus>;
  sign?: '+' | '-';
}> = ({ asset, value, tokenId, txStatus, sign, method }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const decimals = asset?.decimals ?? 0;
  const formatBalance = useFormatBalance(value, decimals);
  const isUnlimited = method === 'approve' && BigInt(value ?? 0) === maxUint256;
  return (
    <View style={styles.assetWrapper}>
      {asset?.type === AssetType.ERC20 || asset?.type === AssetType.Native ? (
        <TokenIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 40 }]} />
      ) : (
        <NFTIcon source={asset?.icon} style={[styles.assetIcon, { borderRadius: 2 }]} />
      )}
      <Text style={[styles.assetText, { color: txStatus === 'failed' ? colors.textSecondary : colors.textPrimary }]} numberOfLines={1}>
        {sign} {isUnlimited ? t('common.approve.unlimited') : formatBalance}
      </Text>
      <Text style={[styles.assetText, { color: txStatus === 'failed' ? colors.textSecondary : colors.textPrimary }]}>
        {asset?.symbol}
        {tokenId && <>&nbsp;#{tokenId}</>}
      </Text>
    </View>
  );
};

const ActivityItem: React.FC<Props> = ({ onPress, tx }) => {
  const navigation = useNavigation<StackScreenProps<typeof HomeStackName>['navigation']>();
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

  const isPending = SPEED_UP_FEATURE.allow && status === 'pending';

  const handlePressCancel = useCallback(() => {
    navigation.navigate(SpeedUpStackName, { txId: tx.id, type: 'Cancel' });
  }, [tx?.id]);

  const handlePressSpeedUp = useCallback(() => {
    navigation.navigate(SpeedUpStackName, { txId: tx.id, type: 'SpeedUp' });
  }, [tx?.id]);

  return (
    <Pressable
      style={[styles.container, isPending && styles.pendingContainer, isPending && { borderColor: colors.borderFourth }]}
      onPress={() => onPress?.(tx)}
    >
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
      {tx.source === TxSource.SELF && <AssetInfo asset={asset} value={value} tokenId={tokenId} txStatus={status} sign="-" method={method} />}
      {method === 'approve' && <AssetInfo asset={asset} value={value} tokenId={tokenId} txStatus={status} method={method} />}

      {isPending && (
        <View style={styles.btnArea}>
          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? colors.underlay : 'transparent', borderColor: colors.borderPrimary }]}
            onPress={handlePressCancel}
          >
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? colors.underlay : 'transparent', borderColor: colors.borderPrimary }]}
            onPress={handlePressSpeedUp}
          >
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>Speed Up</Text>
            <RocketIcon style={styles.rocket} />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: 72,
    marginHorizontal: 16,
    paddingHorizontal: 16,
  },
  pendingContainer: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 15,
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
  assetWrapper: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 100,
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
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
  },
  btn: {
    width: '50%',
    maxWidth: 172,
    flexShrink: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 34,
    borderWidth: 1,
    borderRadius: 4,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
  rocket: {
    marginLeft: 2,
    transform: [{ translateY: 1 }],
  },
});

export default ActivityItem;

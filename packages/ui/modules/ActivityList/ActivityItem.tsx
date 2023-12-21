import { ActivityIndicator, Pressable, View, ViewStyle } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { Tx } from '@core/database/models/Tx';
import { useAssetOfTx, usePayloadOfTx } from '@core/WalletCore/Plugins/ReactInject/data/useTxs';
import { shortenAddress } from '@core/utils/address';
import AttentionIcon from '@assets/icons/attention.svg';
import DoneIcon from '@assets/icons/done.svg';
import { formatStatus, formatTxData } from '@utils/tx';
import { StyleProp } from 'react-native';
import { memo } from 'react';
import { balanceFormat } from '@core/utils/balance';

const ActivityItem: React.FC<{
  onPress?: (item: Tx) => void;
  tx: Tx;
  className?: string;
  style?: StyleProp<ViewStyle>;
}> = memo(({ onPress, tx, className, style }) => {
  const { theme } = useTheme();
  const payload = usePayloadOfTx(tx.id);
  const asset = useAssetOfTx(tx.id);
  const status = formatStatus(tx.status);

  const { value, to, decimals, tokenId } = formatTxData(payload, asset);
  return (
    <Pressable style={style} className={className} onPress={onPress ? () => onPress(tx) : undefined}>
      <View className={'flex flex-row justify-between w-full'}>
        <View>
          <View className="flex flex-row">
            <Text style={{ color: status === 'failed' ? theme.colors.textSecondary : theme.colors.textPrimary }}>Send</Text>
            {status === 'pending' && (
              <View className="p-[5px]">
                <ActivityIndicator color="#4572EC" size={14} />
              </View>
            )}
            {status === 'failed' && <AttentionIcon width={24} height={24} />}
            {status === 'confirmed' && <DoneIcon width={24} height={24} />}
          </View>
          <Text style={{ color: theme.colors.textSecondary }}>To: {shortenAddress(to)}</Text>
        </View>
        <View>
          <Text style={{ color: status === 'failed' ? theme.colors.textSecondary : theme.colors.textPrimary }}>
            - {balanceFormat(value || '0', { decimals })} {asset?.symbol}
            {tokenId && <>&nbsp;#{tokenId}</>}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export default ActivityItem;

import { ActivityIndicator, Pressable, View, ViewStyle } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { AccountTokenListItem, NFTItemDetail } from '@hooks/useTokenList';
import { Tx } from '@core/database/models/Tx';
import { useAssetOfTx, usePayloadOfTx } from '@core/WalletCore/Plugins/ReactInject/data/useTxs';
import { shortenAddress } from '@core/utils/address';
import AttentionIcon from '@assets/icons/attention.svg';
import DoneIcon from '@assets/icons/done.svg';
import { formatStatus } from '@utils/tx';
import { StyleProp } from 'react-native';
import { Asset, AssetType } from '@core/database/models/Asset';
import { formatValue } from '@utils/formatValue';
import { TxPayload } from '@core/database/models/TxPayload';
import { iface1155, iface721, iface777 } from '@core/contracts';

// getContractTransactionData = (
//   currentAddress: string,
//   args: Pick<WalletTransactionType, 'assetType' | 'tokenId' | 'contract' | 'to' | 'amount' | 'decimals'>
// ) => {
//   if (!args.contract) {
//     throw new Error("Get contract transaction data but don't have contract address");
//   }

//   switch (args.assetType) {
//     case AssetType.ERC20: {
//       return iface777.encodeFunctionData('transfer', [args.to, parseUnits(args.amount.toString(), args.decimals)]);
//     }
//     case AssetType.ERC721: {
//       if (typeof args.tokenId === 'undefined') {
//         throw new Error("Get ERC721 transaction data but don't have tokenId");
//       }
//       return iface721.encodeFunctionData('transferFrom', [currentAddress, args.to, args.tokenId]);
//     }
//     case AssetType.ERC1155: {
//       if (typeof args.tokenId === 'undefined') {
//         throw new Error("Get ERC1155 transaction data but don't have tokenId");
//       }

//       return iface1155.encodeFunctionData('safeTransferFrom', [
//         currentAddress,
//         args.to,
//         args.tokenId,
//         parseUnits(args.amount.toString(), args.decimals),
//         '0x',
//       ]);
//     }

//     default: {
//       throw new Error(`Get contract transaction data , only support ERC20, ERC721, ERC1155, but get assetType: ${args.assetType}`);
//     }
//   }
// };

const formatTxData = (payload: TxPayload | null, asset: Asset | null) => {
  let value = payload?.value;
  let to = payload?.to;
  const decimals = asset?.decimals || 18;
  switch (asset?.type) {
    case AssetType.ERC20: {
      if (payload?.data) {
        [to, value] = iface777.decodeFunctionData('transfer', payload.data);
      }
      break;
    }
    case AssetType.ERC721: {
      if (payload?.data) {
        [to, value] = iface721.decodeFunctionData('transferFrom', payload.data);
      }
      break;
    }
    case AssetType.ERC1155: {
      if (payload?.data) {
        [to, value] = iface1155.decodeFunctionData('safeTransferFrom', payload.data);
      }
      break;
    }
  }
  return {
    to,
    value,
    decimals,
  };
};

export interface NFTItemPressArgs {
  assetType: AccountTokenListItem['type'];
  symbol: AccountTokenListItem['symbol'];
  balance: AccountTokenListItem['balance'];
  contract: AccountTokenListItem['contract'];
  tokenId: NFTItemDetail['tokenId'];
  tokenImage: NFTItemDetail['image'];
  contractName: AccountTokenListItem['name'];
  nftName: NFTItemDetail['name'];
  iconUrl: AccountTokenListItem['iconUrl'];
}

const ActivityItem: React.FC<{
  onPress?: (item: Tx) => void;
  tx: Tx;
  className?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ onPress, tx, className, style }) => {
  const { theme } = useTheme();
  const payload = usePayloadOfTx(tx.id);
  const asset = useAssetOfTx(tx.id);
  const status = formatStatus(tx.status);

  const { value, to, decimals } = formatTxData(payload, asset);
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
            - {formatValue(value || '0', decimals)} {asset?.symbol}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

export default ActivityItem;

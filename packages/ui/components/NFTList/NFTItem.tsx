import { Pressable, View } from 'react-native';
import { Icon } from '@rneui/base';
import { ListItem, Text, useTheme } from '@rneui/themed';
import { AccountTokenListItem, NFTItemDetail } from '@hooks/useTokenList';

import TokenIconDefault from '@assets/icons/tokenDefault.svg';
import MixinImage from '@components/MixinImage';
import { AssetType } from '@core/database/models/Asset';
import Skeleton from '@components/Skeleton';
import DefaultNFTImage from '@assets/images/NFT.svg';

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

const NFTItem: React.FC<{
  currentOpen: string | null;
  setCurrentOpen: (v: string | null) => void;
  nftInfo: AccountTokenListItem & { page: number; total: number; NFTList: NFTItemDetail[] };
  ownerAddress: string;
  onPress?: (item: NFTItemPressArgs) => void;
}> = ({ nftInfo, onPress, currentOpen, setCurrentOpen }) => {
  const { theme } = useTheme();
  return (
    <View className="flex flex-1 w-full px-2">
      <ListItem.Accordion
        isExpanded={currentOpen === nftInfo.contract}
        onPress={() => setCurrentOpen(currentOpen === nftInfo.contract ? null : nftInfo.contract)}
        containerStyle={{
          backgroundColor: theme.colors.normalBackground,
          display: 'flex',
          flex: 1,
          justifyContent: 'space-between',
        }}
        icon={<Icon name="keyboard-arrow-right" color={theme.colors.contrastWhiteAndBlack} />}
        expandIcon={<Icon name="keyboard-arrow-up" color={theme.colors.contrastWhiteAndBlack} />}
        content={
          <View className="flex flex-row items-center">
            {nftInfo.iconUrl ? <MixinImage source={{ uri: nftInfo.iconUrl }} width={32} height={32} /> : <TokenIconDefault width={32} height={32} />}
            <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-base font-medium leading-6 ml-2">
              {nftInfo.name}
            </Text>
          </View>
        }
      >
        <ListItem containerStyle={{ backgroundColor: 'transparent' }}>
          <View className="flex flex-row flex-wrap justify-between w-full">
            {currentOpen && nftInfo.NFTList.length === 0 && (
              <View className="flex-1 flex flex-row justify-between">
                {Array.from({ length: 2 }).map((_, i) => (
                  <View key={i} style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md">
                    <View className="w-36 h-36 mb-2">
                      <Skeleton width={142} height={142} />
                    </View>
                    <View className="mb-1">
                      <Skeleton width={70} height={16} />
                    </View>
                    <View>
                      <Skeleton width={141} height={16} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {nftInfo.NFTList.map((v) => (
              <Pressable
                key={v.tokenId}
                onPress={
                  onPress
                    ? () =>
                        onPress({
                          assetType: v.type,
                          tokenId: v.tokenId,
                          tokenImage: v.image,
                          nftName: v.name,
                          iconUrl: nftInfo.iconUrl,
                          symbol: nftInfo.symbol,
                          balance: v.amount,
                          contract: nftInfo.contract,
                          contractName: nftInfo.name,
                        })
                    : undefined
                }
                style={{ width: '48%' }}
              >
                <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md w-full">
                  {v.amount && v.type === AssetType.ERC1155 && (
                    <View className="absolute top-4 right-4 z-10 px-2 rounded-full" style={{ backgroundColor: theme.colors.surfaceCard }}>
                      <Text style={{ color: theme.colors.textPrimary }}>x{v.amount}</Text>
                    </View>
                  )}
                  <View className="flex items-center w-full h-36 overflow-hidden">
                    {v.image ? <MixinImage source={{ uri: v.image }} className="w-full h-full" /> : <DefaultNFTImage />}
                  </View>
                  <Text style={{ color: theme.colors.textSecondary }} className="text-sm leading-6">
                    {nftInfo.name}
                  </Text>
                  <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm leading-6">
                    {v.name} #{v.tokenId}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ListItem>
      </ListItem.Accordion>
    </View>
  );
};

export default NFTItem;

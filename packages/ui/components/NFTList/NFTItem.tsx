import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { firstValueFrom } from 'rxjs';
import { Button, Icon } from '@rneui/base';
import { ListItem, Text, useTheme, Skeleton } from '@rneui/themed';
import { AccountTokenListItem } from '@hooks/useTokenList';
import { TokenType } from '@hooks/useTransaction';
import { scanOpenAPISend } from '@core/utils/send';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';

const pageSize = 24;

export interface NFTItemDetail {
  amount: string;
  contract: string;
  description: string;
  image: string;
  name: string;
  owner: string;
  tokenId: string;
  type: TokenType;
}

export const NFTItem: React.FC<{
  loadMore: boolean;
  nftInfo: AccountTokenListItem;
  ownerAddress: string;
  onPress?: (item: AccountTokenListItem & NFTItemDetail & { contractName: string; nftName: string }) => void;
}> = ({ nftInfo, ownerAddress, onPress }) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState({ page: 0, total: 0 });
  const [list, setList] = useState<NFTItemDetail[]>([]);
  const currentNetwork = useCurrentNetwork();
  // TODO loadMore
  useEffect(() => {
    if (isExpanded && currentNetwork?.chainId) {
      firstValueFrom(
        scanOpenAPISend<{ message: string; result: { list: NFTItemDetail[]; next: number; total: number }; status: string }>(
          currentNetwork?.chainId,
          `/nft/tokens?contract=${nftInfo.contract}&owner=${ownerAddress}&sort=ASC&sortField=latest_update_time&cursor=0&skip=${page.page}&limit=${pageSize}&withBrief=true&withMetadata=false&suppressMetadataError=false`
        )
      ).then((res) => {
        if (page.page === 0) {
          // setList(res);
          setPage({ page: 0, total: res.result.total });
          setList(res.result.list);
        } else {
          setList((v) => {
            const hash = v.reduce((acc, cur) => {
              acc[cur.tokenId] = true;
              return acc;
            }, {} as Record<string, boolean>);
            return [...v, ...res.result.list.filter((v) => !hash[v.tokenId])];
          });
        }
      });
    }
  }, [isExpanded, nftInfo.contract, ownerAddress, page.page, currentNetwork?.chainId]);

  return (
    <View className="flex flex-1 w-full">
      <ListItem.Accordion
        isExpanded={isExpanded}
        onPress={() => setIsExpanded(!isExpanded)}
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
            {nftInfo.iconUrl ? <Image source={{ uri: nftInfo.iconUrl }} width={32} height={32} /> : <TokenIconDefault width={32} height={32} />}
            <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-base font-medium leading-6 ml-2">
              {nftInfo.name}
            </Text>
          </View>
        }
      >
        <ListItem containerStyle={{ backgroundColor: 'transparent' }}>
          <View className="flex flex-row flex-wrap justify-between">
            {isExpanded && list.length === 0 && (
              <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md">
                <View className="w-36 h-36">
                  <Skeleton width={144} height={144} />
                </View>
                <Text style={{ color: theme.colors.textSecondary }} className="text-sm leading-6">
                  <Skeleton width={74} height={21} />
                </Text>
                <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm leading-6">
                  <Skeleton width={141} height={21} />
                </Text>
              </View>
            )}

            {list.map((v) => (
              <Pressable
                key={v.tokenId}
                onPress={onPress ? () => onPress({ ...nftInfo, ...v, contractName: nftInfo.name, nftName: v.name }) : undefined}
                style={{ width: '48%' }}
              >
                <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md">
                  <View className="flex items-center w-full h-36 overflow-hidden">
                    {v.image && <Image source={{ uri: v.image }} className="w-full h-full" />}
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
            {list.length < page.total && <Button onPress={() => setPage({ page: page.page + 1, total: page.total })}>Load More</Button>}
          </View>
        </ListItem>
      </ListItem.Accordion>
    </View>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { firstValueFrom, err } from 'rxjs';
import { Button, Icon } from '@rneui/base';
import { ListItem, Text, useTheme, Skeleton } from '@rneui/themed';
import { AccountTokenListItem } from '@hooks/useTokenList';
import { TokenType } from '@hooks/useTransaction';
import { scanOpenAPISend } from '@core/utils/send';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import MixinImage from '@components/MixinImage';

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
  error?: string;
}

export const NFTItem: React.FC<{
  currentOpen: string | null;
  setCurrentOpen: (v: string | null) => void;
  loadMore: boolean;
  nftInfo: AccountTokenListItem;
  ownerAddress: string;
  onPress?: (item: AccountTokenListItem & NFTItemDetail & { contractName: string; nftName: string }) => void;
}> = ({ nftInfo, ownerAddress, onPress, currentOpen, setCurrentOpen, loadMore }) => {
  const { theme } = useTheme();
  const [page, setPage] = useState({ page: 0, total: 0 });
  const [list, setList] = useState<NFTItemDetail[]>([]);
  const currentNetwork = useCurrentNetwork();
  const firstRequest = useRef(true);
  const inRequest = useRef(false);

  const requestNFT = useCallback(async () => {
    if (currentOpen === nftInfo.contract && currentNetwork?.chainId) {
      let skip = 0;
      console.log(loadMore, page.total, page.page * pageSize);
      if (loadMore && page.total > page.page * pageSize) {
        skip = page.page * pageSize;
      }
      inRequest.current = true;
      firstValueFrom(
        scanOpenAPISend<{ message: string; result: { list: NFTItemDetail[]; next: number; total: number }; status: string }>(
          currentNetwork?.chainId,
          `/nft/tokens?contract=${nftInfo.contract}&owner=${ownerAddress}&sort=ASC&sortField=latest_update_time&cursor=0&skip=${skip}&limit=${pageSize}&withBrief=true&withMetadata=false&suppressMetadataError=true`
        )
      )
        .then((res) => {
          if (page.page === 0) {
            setPage({ page: 1, total: res.result.total });
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
        })
        .finally(() => {
          inRequest.current = false;
        });
    }
  }, [currentOpen, nftInfo.contract, ownerAddress, page.page, currentNetwork?.chainId, page.total, loadMore]);

  // TODO loadMore
  useEffect(() => {
    if (currentOpen === nftInfo.contract && firstRequest.current) {
      firstRequest.current = false;
      requestNFT();
    }
  }, [requestNFT, currentOpen, nftInfo.contract]);

  useEffect(() => {
    if (currentOpen === nftInfo.contract && loadMore && !firstRequest.current && !inRequest.current && list.length < page.total) {
      requestNFT();
    }
  }, [loadMore, requestNFT, currentOpen, nftInfo.contract, list.length, page.total]);
  return (
    <View className="flex flex-1 w-full">
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
            {currentOpen && list.length === 0 && (
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
                <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md w-full">
                  {v.amount && v.type === TokenType.ERC1155 && (
                    <View className="absolute top-4 right-4 z-10 px-2 rounded-full" style={{ backgroundColor: theme.colors.surfaceCard }}>
                      <Text style={{ color: theme.colors.textPrimary }}>x{v.amount}</Text>
                    </View>
                  )}
                  <View className="flex items-center w-full h-36 overflow-hidden">
                    {v.image && <MixinImage source={{ uri: v.image }} className="w-full h-full" />}
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

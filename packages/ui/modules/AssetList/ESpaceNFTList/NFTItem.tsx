import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@rneui/base';
import { ListItem, Text, useTheme } from '@rneui/themed';
import { createFetchServer } from '@cfx-kit/dapp-utils/dist/fetch';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_MAINNET_SCAN_OPENAPI, CFX_ESPACE_TESTNET_SCAN_OPENAPI } from '@core/consts/network';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type Network } from '@core/database/models/Network';
import { type Address } from '@core/database/models/Address';
import { AssetType } from '@core/database/models/Asset';
import useInAsync from '@hooks/useInAsync';
import Skeleton from '@components/Skeleton';
import MixinImage from '@components/MixinImage';
import TokenIconDefault from '@assets/icons/defaultToken.svg';
import DefaultNFTImage from '@assets/images/NFT.svg';
import { type NFTItemDetail, type NFTWithDetail } from '.';

const responseHandler = (res: {
  status: '0' | '1';
  message: string;
  result?: { list: Array<{ amount: string; description: string; image: string; name: string; tokenId: string }> };
}) => {
  if (res?.result?.list) {
    return res.result.list.map(
      (item) => ({ amount: item.amount, description: item.description, icon: item.image, name: item.name, tokenId: item.tokenId } as NFTItemDetail)
    );
  }
  return null;
};
const fetchESpaceScanTestnet = createFetchServer({ prefixUrl: CFX_ESPACE_TESTNET_SCAN_OPENAPI, responseHandler });
const fetchESpaceScanMainnet = createFetchServer({ prefixUrl: CFX_ESPACE_MAINNET_SCAN_OPENAPI, responseHandler });

const NFTItem: React.FC<{
  data: AssetInfo;
  isExpanded: boolean;
  isCurrentOpenHeaderInView: boolean;
  onPress?: () => void;
  onSelectNftItem?: (nft: NFTWithDetail) => void;
  currentNetwork: Network;
  currentAddress: Address;
}> = ({ onPress, onSelectNftItem, data, isExpanded, isCurrentOpenHeaderInView, currentNetwork, currentAddress }) => {
  const { theme } = useTheme();

  const [details, setDetails] = useState<Array<NFTItemDetail> | null>(null);

  const fetchCurrentNFTDetail = useCallback(async () => {
    const fetchESpaceScan = currentNetwork?.chainId === CFX_ESPACE_MAINNET_CHAINID ? fetchESpaceScanMainnet : fetchESpaceScanTestnet;
    const fetchKey = `nftDetail-${data.contractAddress}-${currentAddress?.hex}-${currentNetwork?.chainId}`;
    return fetchESpaceScan
      .fetchServer<Array<NFTItemDetail>>({
        url: `nft/tokens?contract=${data.contractAddress}&owner=${currentAddress.hex}&cursor=0&limit=100&sort=ASC&sortField=latest_update_time&withBrief=true&withMetadata=false&suppressMetadataError=true`,
        key: fetchKey,
        options: {
          retry: 2
        }
      })
      .then((res) => res && setDetails(res))
      .catch((err) => {
        console.error('fetch Nft detail err: ', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { inAsync: inFetch, execAsync: execFetch } = useInAsync(fetchCurrentNFTDetail);

  useEffect(() => {
    if (isExpanded) {
      execFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  return (
    <>
      {(!isExpanded || (isExpanded && isCurrentOpenHeaderInView)) && (
        <ListItem.Accordion
          isExpanded={isExpanded}
          onPress={onPress}
          containerStyle={{
            backgroundColor: theme.colors.normalBackground,
            display: 'flex',
            flex: 1,
            justifyContent: 'space-between',
          }}
          style={{ paddingHorizontal: 8 }}
          icon={<Icon name="keyboard-arrow-down" color={theme.colors.contrastWhiteAndBlack} />}
          content={
            <View className="flex flex-row items-center">
              {data.icon ? (
                <MixinImage source={{ uri: data.icon }} width={32} height={32} fallback={<TokenIconDefault width={32} height={32} />} />
              ) : (
                <TokenIconDefault width={32} height={32} />
              )}
              <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-base font-medium leading-6 ml-2">
                {data.name}
              </Text>
            </View>
          }
        />
      )}
      {isExpanded && (
        <ListItem containerStyle={{ backgroundColor: 'transparent' }}>
          <View className="flex flex-row flex-wrap justify-between w-full">
            {inFetch && !details && (
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

            {details &&
              details.map((detail) => (
                <Pressable key={detail.tokenId} style={{ width: '48%' }} onPress={() => onSelectNftItem?.({ ...data, detail })}>
                  <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md w-full">
                    {detail.amount && data.type === AssetType.ERC1155 && (
                      <View className="absolute top-4 right-4 z-10 px-2 rounded-full" style={{ backgroundColor: theme.colors.surfaceCard }}>
                        <Text style={{ color: theme.colors.textPrimary }}>x{detail.amount}</Text>
                      </View>
                    )}
                    <View className="flex items-center w-full h-36 overflow-hidden">
                      {detail.icon ? (
                        <MixinImage source={{ uri: detail.icon }} fallback={<DefaultNFTImage />} className="w-full h-full" />
                      ) : (
                        <DefaultNFTImage />
                      )}
                    </View>
                    <Text style={{ color: theme.colors.textSecondary }} className="text-sm leading-6">
                      {data.name}
                    </Text>
                    <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm leading-6">
                      {detail.name} #{detail.tokenId}
                    </Text>
                  </View>
                </Pressable>
              ))}
          </View>
        </ListItem>
      )}
    </>
  );
};

export default NFTItem;

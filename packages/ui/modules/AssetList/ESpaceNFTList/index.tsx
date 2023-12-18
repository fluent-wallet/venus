import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useCurrentAddress, useCurrentNetwork, useAssetsNFTList } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import Skeleton from '@components/Skeleton';
import NFTItem from './NFTItem';

export interface NFTItemDetail {
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
  tokenId: string;
}

export type NFTWithDetail = AssetInfo & { detail: NFTItemDetail };

const ESpaceNFTList: React.FC<{ onSelectNftItem?: (nft: NFTWithDetail) => void }> = ({ onSelectNftItem }) => {
  const nfts = useAssetsNFTList();
  const currentAddress = useCurrentAddress()!;
  const currentNetwork = useCurrentNetwork()!;
  const [currentOpenNft, setCurrentOpenNft] = useState<string | null>(null);

  useEffect(() => {
    setCurrentOpenNft(null);
  }, [currentNetwork?.chainId, currentAddress?.hex]);

  if (!currentAddress || !currentNetwork) {
    return null;
  }

  return (
    <ScrollView>
      {nfts === null ? (
        <View className="flex-1 ">
          <View className="flex flex-row items-center p-6">
            <Skeleton circle width={32} height={32} style={{ marginRight: 8 }} />
            <Skeleton width={70} height={16} />
          </View>
          <View className="flex flex-row items-center p-6">
            <Skeleton circle width={32} height={32} style={{ marginRight: 8 }} />
            <Skeleton width={70} height={16} />
          </View>
        </View>
      ) : (
        nfts.map((nft) => (
          <NFTItem
            data={nft}
            key={nft.contractAddress}
            isExpanded={currentOpenNft === nft.contractAddress}
            onPress={() => setCurrentOpenNft((pre) => (pre === nft.contractAddress! ? null : nft.contractAddress!))}
            onSelectNftItem={onSelectNftItem}
            currentNetwork={currentNetwork}
            currentAddress={currentAddress}
          />
        ))
      )}
    </ScrollView>
  );
};

export default ESpaceNFTList;

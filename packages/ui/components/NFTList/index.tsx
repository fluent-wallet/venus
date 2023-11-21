import { ScrollView, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { AccountTokenListItem, ERC721And1155TokenListAtom } from '@hooks/useTokenList';
import { useAtom } from 'jotai';
import { NFTItemDetail, NFTItem } from './NFTItem';
import { useCurrentAddress } from '@core/WalletCore/Plugins/ReactInject';

const NFTList: React.FC<{ onPress?: (v: AccountTokenListItem & NFTItemDetail & { contractName: string; nftName: string }) => void }> = ({ onPress }) => {
  const [tokenList] = useAtom(ERC721And1155TokenListAtom);
  const address = useCurrentAddress()!;

  const handleSelectNFT = (token: NFTItemDetail & AccountTokenListItem & { contractName: string; nftName: string }) => {
    if (onPress) {
      onPress(token);
    }
  };

  return (
    <ScrollView>
      {tokenList ? (
        tokenList.map((item) => <NFTItem key={item.contract} nftInfo={item} ownerAddress={address.hex} onPress={handleSelectNFT} />)
      ) : (
        <View className="flex flex-row items-center px-7">
          <Skeleton circle width={32} height={32} className="mr-2" />
          <Skeleton width={200} height={20} />
        </View>
      )}
    </ScrollView>
  );
};

export default NFTList;

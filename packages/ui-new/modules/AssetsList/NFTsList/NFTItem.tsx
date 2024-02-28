import { Pressable, View, TouchableHighlight } from 'react-native';
import clsx from 'clsx';
import { Icon } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { AssetType } from '@core/database/models/Asset';
import Skeleton from '@components/Skeleton';
import MixinImage from '@components/MixinImage';
import DefaultNFTAvatar from '@assets/icons/defaultNFT.svg';
import DefaultNFTImage from '@assets/images/NFT.svg';
import { type NFTWithDetail, type NFTItemDetail } from './fetch';

const NFTItem: React.FC<{
  data: AssetInfo;
  isExpanded: boolean;
  isCurrentOpenHeaderInView: boolean;
  onPress?: () => void;
  onSelectNftItem?: (nft: NFTWithDetail) => void;
  isCurrentOpenNftInFetch: boolean;
  details: Array<NFTItemDetail> | null;
  index: number;
  nftLength: number;
}> = ({ onPress, onSelectNftItem, data, isExpanded, isCurrentOpenHeaderInView, isCurrentOpenNftInFetch, details, index, nftLength }) => {
  const { theme } = useTheme();

  return (
    <>
      {(!isExpanded || (isExpanded && isCurrentOpenHeaderInView)) && (
        <TouchableHighlight
          testID={`"NFTTitle-${data.contractAddress}}`}
          onPress={onPress}
          underlayColor={theme.colors.underlayColor}
          className={clsx(
            'border-l-[1px] border-r-[1px]',
            index === 0 && 'rounded-t-[10px] border-t-[1px]',
            index === nftLength - 1 && !isExpanded && 'rounded-b-[10px] border-b-[1px]',
          )}
          style={{ backgroundColor: theme.colors.pureBlackAndWight, borderColor: theme.colors.borderSecondary }}
        >
          <View className="relative flex flex-row items-center w-full h-[72px] px-[24px]">
            {data.icon ? (
              <MixinImage
                source={{ uri: data.icon }}
                width={32}
                height={32}
                className="rounded-full"
                fallback={<DefaultNFTAvatar className="rounded-full" width={32} height={32} />}
              />
            ) : (
              <DefaultNFTAvatar className="rounded-full" width={32} height={32} />
            )}
            <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-base font-medium ml-[8px] mr-auto">
              {data.name}
            </Text>

            <View className={clsx(isExpanded && 'rotate-[-180deg]')}>
              <Icon name="keyboard-arrow-down" color={theme.colors.surfaceFourth} />
            </View>
            {index !== 0 && <View className="absolute top-0 left-0 w-[120%] h-[1px]" style={{ backgroundColor: theme.colors.borderSecondary }} />}
          </View>
        </TouchableHighlight>
      )}

      {isExpanded && (
        <View
          className={clsx(
            'flex flex-row flex-wrap justify-between w-full p-[10px] border-l-[1px] border-r-[1px] overflow-hidden',
            index === nftLength - 1 && isExpanded && 'rounded-b-[10px] border-b-[1px]',
          )}
          style={{ backgroundColor: theme.colors.pureBlackAndWight, borderColor: theme.colors.borderSecondary }}
        >
          {isCurrentOpenNftInFetch && !details && (
            <>
              {Array.from({ length: 2 }).map((_, i) => (
                <View
                  key={i}
                  style={{ backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderSecondary }}
                  className="p-[12px] w-[48%] rounded-[6px] border-[1px] overflow-hidden"
                >
                  <View className="w-full aspect-square rounded-[8px] overflow-hidden">
                    <Skeleton width="100%" height="100%" />
                  </View>
                  <View className="mt-[8px] mb-[4px]">
                    <Skeleton width={70} height={16} />
                  </View>
                  <View>
                    <Skeleton width={141} height={16} />
                  </View>
                </View>
              ))}
            </>
          )}

          {details &&
            details.map((detail, _index) => (
              <Pressable
                testID="NFTItem"
                key={detail.tokenId}
                style={{ width: '48%', marginTop: _index > 1 ? 16 : 0 }}
                onPress={() => onSelectNftItem?.({ ...data, detail })}
              >
                <View
                  style={{ backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderSecondary }}
                  className="relative w-full p-[12px] rounded-[8px] border-[1px] overflow-hidden"
                >
                  <View className="flex items-center w-full aspect-square rounded-[8px] overflow-hidden">
                    {detail.icon ? (
                      <MixinImage source={{ uri: detail.icon }} fallback={<DefaultNFTImage width="100%" height="100%" />} className="w-full h-full" />
                    ) : (
                      <DefaultNFTImage width="100%" height="100%" />
                    )}
                  </View>
                  <Text style={{ color: theme.colors.textSecondary }} className="mt-[8px] mb-[4px] text-sm leading-[16px]">
                    {data.name}
                  </Text>
                  <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm leading-[16px]">
                    {detail.name} #{detail.tokenId}
                  </Text>
                  {detail.amount && data.type === AssetType.ERC1155 && (
                    <View
                      className="absolute top-[16px] right-[16px] z-10 max-w-[128px] px-2 rounded-full"
                      style={{ backgroundColor: theme.colors.surfaceCard }}
                    >
                      <Text className="text-[10px]" style={{ color: theme.colors.textPrimary }} numberOfLines={1}>
                        x{detail.amount}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
        </View>
      )}
    </>
  );
};

export default NFTItem;

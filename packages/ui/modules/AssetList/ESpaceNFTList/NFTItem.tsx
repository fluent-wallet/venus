import { Pressable, View, ActivityIndicator, TouchableHighlight } from 'react-native';
import clsx from 'clsx';
import { Icon } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { AssetType } from '@core/database/models/Asset';
import Skeleton from '@components/Skeleton';
import MixinImage from '@components/MixinImage';
import TokenIconDefault from '@assets/icons/defaultToken.svg';
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
}> = ({ onPress, onSelectNftItem, data, isExpanded, isCurrentOpenHeaderInView, isCurrentOpenNftInFetch, details }) => {
  const { theme } = useTheme();
  return (
    <>
      {(!isExpanded || (isExpanded && isCurrentOpenHeaderInView)) && (
        <TouchableHighlight testID='NFTTitle' onPress={onPress} underlayColor={theme.colors.underlayColor}>
          <View className="flex flex-row h-[64px] px-[24px] items-center">
            {data.icon ? (
              <MixinImage source={{ uri: data.icon }} width={32} height={32} fallback={<TokenIconDefault width={32} height={32} />} />
            ) : (
              <TokenIconDefault width={32} height={32} />
            )}
            <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className={clsx('text-base font-medium ml-[8px]', false ? 'mr-[16px]' : 'mr-auto')}>
              {data.name}
            </Text>
            {/* {isExpanded && isCurrentOpenNftInFetch && details && <ActivityIndicator color={theme.colors.textBrand} size={16} className="mr-auto" />} */}

            <View className={clsx(isExpanded && 'rotate-[-180deg]')}>
              <Icon name="keyboard-arrow-down" color={theme.colors.contrastWhiteAndBlack} />
            </View>
          </View>
        </TouchableHighlight>
      )}

      {isExpanded && (
        <View className="flex flex-row flex-wrap justify-between w-full px-[16px] py-[16px]">
          {isCurrentOpenNftInFetch && !details && (
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
              <Pressable testID='NFTItem' key={detail.tokenId} style={{ width: '48%' }} onPress={() => onSelectNftItem?.({ ...data, detail })}>
                <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md w-full ">
                  {detail.amount && data.type === AssetType.ERC1155 && (
                    <View className="absolute top-4 right-4 z-10 px-2 rounded-full" style={{ backgroundColor: theme.colors.surfaceCard }}>
                      <Text className="text-[10px]" style={{ color: theme.colors.textPrimary }}>
                        x{detail.amount}
                      </Text>
                    </View>
                  )}
                  <View className="flex items-center w-full h-36 overflow-hidden">
                    {detail.icon ? (
                      <MixinImage source={{ uri: detail.icon }} fallback={<DefaultNFTImage />} className="w-full h-full rounded-lg" />
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
      )}
    </>
  );
};

export default NFTItem;

import Copy from '@assets/icons/copy.svg';
import More from '@assets/icons/more.svg';
import Checkbox from '@components/Checkbox';
import Text from '@components/Text';
import { shortenAddress } from '@core/utils/address';
import { useTheme } from '@react-navigation/native';
import { toDataUrl } from '@utils/blockies';
import { Image } from 'expo-image';
import type React from 'react';
import { Pressable, View } from 'react-native';
import { styles } from './styles';

const AccountItemView: React.FC<{
  showSelect?: boolean;
  showMore?: boolean;
  showCopy?: boolean;
  addressValue: string;
  nickname?: string;
  shorten?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  showUnderlay?: boolean;
  innerPaddingHorizontal?: boolean;
}> = ({
  showSelect,
  showMore,
  addressValue,
  nickname,
  children,
  shorten = true,
  showUnderlay = true,
  disabled,
  showCopy,
  onPress,
  innerPaddingHorizontal = true,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: showUnderlay && pressed ? colors.underlay : 'transparent',
          position: 'relative',
          paddingLeft: innerPaddingHorizontal ? 16 : 0,
          paddingRight: 0,
        },
      ]}
      pointerEvents={!onPress ? 'none' : 'auto'}
      onPress={onPress}
      disabled={disabled}
    >
      <Image style={styles.accountImage} source={{ uri: toDataUrl(addressValue) }} recyclingKey={addressValue} />
      <View style={{ flex: 1 }}>
        {nickname && (
          <Text style={[styles.accountName, { color: colors.textPrimary, paddingRight: 16 }]} numberOfLines={1}>
            {nickname}
          </Text>
        )}
        <View style={styles.accountAddressWrapper}>
          <Text
            style={[
              styles.accountAddress,
              !nickname && styles.accountName,
              {
                color: nickname ? colors.textSecondary : colors.textPrimary,
                borderRightColor: showCopy ? colors.borderFourth : 'transparent',
                borderRightWidth: showCopy ? 1 : 0,
                paddingRight: showCopy ? 5 : 0,
              },
            ]}
          >
            {shorten ? shortenAddress(addressValue) : addressValue}
          </Text>
          {showCopy && <Copy style={styles.accountAddressCopy} color={colors.textPrimary} />}
        </View>
      </View>
      {showSelect && <Checkbox style={styles.accountRight} checked pointerEvents="none" />}
      {showMore && <More style={styles.accountRight} color={colors.textSecondary} />}
      {children}
    </Pressable>
  );
};

export default AccountItemView;

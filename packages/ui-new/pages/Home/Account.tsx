import ArrowLeft from '@assets/icons/arrow-left.svg';
import ExistWallet from '@assets/icons/wallet-Imported.webp';
import BSIMCardWallet from '@assets/icons/wallet-bsim.webp';
import HDWallet from '@assets/icons/wallet-hd.webp';
import Text from '@components/Text';
import { VaultType, useCurrentAccount, useCurrentAddressValueOfAccount, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import useForceUpdateOnFocus from '@hooks/useUpdateOnFocus';
import { useTheme } from '@react-navigation/native';
import type { HomeStackName, StackScreenProps } from '@router/configs';
import { toDataUrl } from '@utils/blockies';
import { Image } from 'expo-image';
import type React from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const AnimatedArrowLeft = Animated.createAnimatedComponent(ArrowLeft);

const Account: React.FC<{ showAccountSelector: boolean; onPress: () => void; navigation: StackScreenProps<typeof HomeStackName>['navigation'] }> = ({
  showAccountSelector,
  navigation,
  onPress,
}) => {
  const { colors } = useTheme();
  const account = useCurrentAccount();
  const addressValue = useCurrentAddressValueOfAccount(account?.id);
  const vault = useVaultOfAccount(account?.id);
  useForceUpdateOnFocus(navigation);

  const rotation = useSharedValue(-180);

  useEffect(() => {
    rotation.value = withTiming(showAccountSelector ? -90 : -180, {
      duration: 200,
    });
  }, [showAccountSelector, rotation]);

  const animatedArrowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }, { translateX: -1.5 }],
    };
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.accountContainer,
        {
          borderColor: colors.borderThird,
          backgroundColor: pressed ? colors.underlay : 'transparent',
        },
      ]}
      onPress={onPress}
      testID="account"
    >
      <View style={styles.accountImageWrapper}>
        <Image style={styles.accountImage} source={{ uri: toDataUrl(addressValue) }} />
        <Image
          style={styles.acccountImageBSIMCard}
          source={vault?.type === VaultType.BSIM ? BSIMCardWallet : vault?.type === VaultType.HierarchicalDeterministic ? HDWallet : ExistWallet}
        />
      </View>
      <Text style={[styles.accountText, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="middle">
        {account?.nickname ?? 'Loading...'}
      </Text>
      <AnimatedArrowLeft style={[styles.accountArrow, animatedArrowStyle]} color={colors.iconPrimary} width={14} height={14} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  accountContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accountImageWrapper: {
    position: 'relative',
    width: 24,
    height: 24,
    marginRight: 12,
  },
  accountImage: {
    width: 24,
    height: 24,
    borderRadius: 24,
  },
  acccountImageBSIMCard: {
    position: 'absolute',
    width: 20,
    height: 20,
    right: -7,
    bottom: -3,
  },
  accountText: {
    maxWidth: 132,
    fontSize: 14,
    fontWeight: '300',
  },
  accountArrow: {
    marginLeft: 8.5,
  },
});

export default Account;

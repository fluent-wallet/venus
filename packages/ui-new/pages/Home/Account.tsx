import React from 'react';
import { TouchableHighlight, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCurrentAccount, useCurrentAddressOfAccount, useVaultOfAccount, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import { zeroAddress } from '@core/utils/address';
import Text from '@components/Text';
import { toDataUrl } from '@utils/blockies';
import BSIMCard from '@assets/icons/bsim-card.webp';
import ArrowLeft from '@assets/icons/arrow-left.svg';

const Account: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { colors } = useTheme();
  const account = useCurrentAccount();
  const address = useCurrentAddressOfAccount(account?.id);
  const vault = useVaultOfAccount(account?.id);

  return (
    <TouchableHighlight underlayColor={colors.underlay} onPress={onPress} style={styles.accountHighLight}>
      <View style={[styles.accountContainer, { borderColor: colors.borderThird }]}>
        <View style={styles.accountImageWrapper}>
          <Image style={styles.accountImage} source={{ uri: toDataUrl(address?.hex || zeroAddress) }} />
          {vault?.type === VaultType.BSIM && <Image style={styles.acccountImageBSIMCard} source={BSIMCard} />}
        </View>
        <Text style={[styles.accountText, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="middle">
          {account?.nickname ?? 'Loading...'}
        </Text>
        <ArrowLeft style={styles.accountArrow} color={colors.iconPrimary} />
      </View>
    </TouchableHighlight>
  );
};

const styles = StyleSheet.create({
  accountHighLight: {
    overflow: 'hidden',
    borderRadius: 6,
  },
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
  },
  accountImageWrapper: {
    position: 'relative',
    width: 24,
    height: 24,
    marginRight: 8,
  },
  accountImage: {
    width: 24,
    height: 24,
    borderRadius: 22,
  },
  acccountImageBSIMCard: {
    position: 'absolute',
    width: 22,
    height: 14.66,
    right: -5,
    bottom: -2,
  },
  accountText: {
    maxWidth: 132,
    fontSize: 14,
    fontWeight: '300',
  },
  accountArrow: {
    marginLeft: 9.5,
    transform: [{ rotate: '-90deg' }, { translateX: -3 }],
  },
});

export default Account;

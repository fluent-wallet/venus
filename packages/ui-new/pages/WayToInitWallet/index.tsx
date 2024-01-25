import React, { useCallback } from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import plugins from '@core/WalletCore/Plugins';
import { WayToInitWalletStackName, HomeStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right.svg';
import welcomeSwiftShieldDark from '@assets/images/welcome-SwiftShield-dark.webp';
import welcomeSwiftShieldLight from '@assets/images/welcome-SwiftShield-light.webp';
import welcomeBgLight from '@assets/images/welcome-bg-light.webp';
import welcomeBgDark from '@assets/images/welcome-bg-dark.webp';
import Img from '@assets/images/welcome-img.webp';

const WayToInitWallet: React.FC<{ navigation: StackScreenProps<typeof WayToInitWalletStackName> }> = ({ navigation }) => {
  const { mode, colors } = useTheme();

  const handleConnectBSIMCard = useCallback(async () => {
    try {
      await plugins.BSIM.getBSIMVersion();
      // navigation.navigate(BiometricsStackName, { type: 'BSIM' });
    } catch (error) {
      showMessage({
        message: `Can't find the BSIM Card`,
        description: "Please make sure you've inserted the BSIM Card and try again.",
        type: 'warning',
        duration: 3000,
      });
    }
  }, []);

  return (
    <ImageBackground source={mode === 'dark' ? welcomeBgDark : welcomeBgLight} style={styles.bg} resizeMode="cover">
      <SafeAreaView style={styles.container}>
        <Image style={styles.img} source={Img} contentFit="fill" />
        <Image style={styles.welcomeSwiftShield} source={mode === 'dark' ? welcomeSwiftShieldDark : welcomeSwiftShieldLight} contentFit="fill" />

        <Button testID="connectBSIMWallet" textAlign="left" Icon={ArrowRight} style={styles.btn} onPress={handleConnectBSIMCard}>
          Connect BSIM Wallet
        </Button>

        <Text style={[styles.orAddWith, { color: colors.textThird }]}>or add with:</Text>

        <Button testID="createNewWallet" textAlign="left" style={styles.btn}>
          Create new wallet
        </Button>

        <Button testID="importExistingWallet" textAlign="left" style={styles.btn}>
          Import existing wallet
        </Button>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 40,
  },
  img: {
    width: 240,
    height: 240,
    marginBottom: 68,
  },
  welcomeSwiftShield: {
    width: 336,
    height: 100,
    marginBottom: 24,
  },
  orAddWith: {
    marginBottom: 16,
    width: 360,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'left',
  },
  btn: {
    width: 360,
    marginBottom: 16,
  },
});

export default WayToInitWallet;

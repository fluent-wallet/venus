import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, StackActions } from '@react-navigation/native';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import { WelcomeStackName, WayToInitWalletStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right.svg';
import EnterWeb3Dark from '@assets/images/enter-web3-dark.webp';
import EnterWeb3Light from '@assets/images/enter-web3-light.webp';
import welcomeBgLight from '@assets/images/welcome-bg-light.webp';
import welcomeBgDark from '@assets/images/welcome-bg-dark.webp';
import Img from '@assets/images/welcome-img.webp';

const Welcome: React.FC<{ navigation: StackScreenProps<typeof WelcomeStackName> }> = ({ navigation }) => {
  const { mode, colors } = useTheme();

  return (
    <ImageBackground source={mode === 'dark' ? welcomeBgDark : welcomeBgLight} style={styles.bg} resizeMode="cover">
      <SafeAreaView style={styles.container}>
        <Image style={styles.enterWeb3} source={mode === 'dark' ? EnterWeb3Dark : EnterWeb3Light} />
        <Text style={[styles.first, { color: colors.textFifth, backgroundColor: colors.bgThird }]}>First, let's add a wallet</Text>
        <Image style={styles.img} source={Img} />

        <Button
          testID="Get Started"
          textAlign="left"
          Icon={ArrowRight}
          style={styles.btn}
          onPress={() => navigation.dispatch(StackActions.replace(WayToInitWalletStackName))}
        >
          Get Started
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
    paddingTop: 48,
    paddingHorizontal: 16
  },
  enterWeb3: {
    width: 232,
    height: 100,
  },
  first: {
    marginTop: 24,
    fontFamily: 'Stalinist One',
    width: 230,
    height: 24,
    lineHeight: 24,
    fontSize: 10,
    textAlign: 'center',
  },
  img: {
    width: 388,
    height: 388,
    marginTop: 24,
  },
  btn: {
    width: '100%',
    marginTop: 44,
  },
});

export default Welcome;

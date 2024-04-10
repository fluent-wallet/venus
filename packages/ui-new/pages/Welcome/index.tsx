import React from 'react';
import { ImageBackground, View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import Button from '@components/Button';
import { WelcomeStackName, WayToInitWalletStackName, type StackScreenProps } from '@router/configs';
import ArrowRight from '@assets/icons/arrow-right.svg';
import EnterWeb3Dark from '@assets/images/enter-web3-dark.webp';
// import EnterWeb3Light from '@assets/images/enter-web3-light.webp';
// import WelcomeBgLight from '@assets/images/welcome-bg-light.webp';
import WelcomeBgDark from '@assets/images/welcome-bg-dark.webp';
// import WelcomeTextLight from '@assets/images/enter-web3-text-light.webp';
import WelcomeTextDark from '@assets/images/enter-web3-text-dark.webp';
import ImgNew from '@assets/images/enter-web3-img-new.webp';
import { useTranslation } from 'react-i18next';

const Welcome: React.FC<StackScreenProps<typeof WelcomeStackName>> = ({ navigation }) => {
  const { t } = useTranslation();

  return (
    <ImageBackground source={WelcomeBgDark} style={styles.bg} resizeMode="cover">
      <ScrollView>
        <SafeAreaView style={styles.container}>
          <Image style={styles.enterWeb3} source={EnterWeb3Dark} contentFit="contain" />
          <View style={[styles.first, { backgroundColor: '#FAFAFA' }]}>
            <Image style={styles.firstText} source={WelcomeTextDark} contentFit="contain" />
          </View>
          <Image style={styles.img} source={ImgNew} />
          <Button
            testID="Get Started"
            textAlign="left"
            Icon={ArrowRight}
            style={styles.btn}
            // onPress={() => navigation.dispatch(StackActions.replace(WayToInitWalletStackName))}
            onPress={() => navigation.navigate(WayToInitWalletStackName)}
            mode="dark"
          >
            {t('welcome.getStarted')}
          </Button>
        </SafeAreaView>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  container: {
    paddingTop: 44,
    paddingHorizontal: 16,
  },
  enterWeb3: {
    alignSelf: 'center',
    width: 232,
    height: 100,
  },
  first: {
    alignSelf: 'center',
    marginTop: 24,
    width: 230,
    height: 24,
    paddingHorizontal: 10,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstText: {
    width: 198,
    aspectRatio: 4.5,
  },
  img: {
    alignSelf: 'center',
    width: 352,
    aspectRatio: 1,
    marginTop: 52,
  },
  btn: {
    marginTop: 45,
    marginBottom: 32,
  },
});

export default Welcome;

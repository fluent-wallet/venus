import ArrowRight from '@assets/icons/arrow-right.svg';
import EnterWeb3EN from '@assets/images/enter-web3-en.webp';
import EnterWeb3ZH from '@assets/images/enter-web3-zh.webp';
import WelcomeBgDark from '@assets/images/welcome-bg-dark.webp';
import Button from '@components/Button';
import { Lang, useLanguage } from '@hooks/useI18n';
import { type StackScreenProps, WayToInitWalletStackName, type WelcomeStackName } from '@router/configs';
import { Image } from 'expo-image';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieAnimation from './lottie';

const Welcome: React.FC<StackScreenProps<typeof WelcomeStackName>> = ({ navigation }) => {
  const { t } = useTranslation();
  const lang = useLanguage();

  return (
    <ImageBackground source={WelcomeBgDark} style={styles.bg} resizeMode="cover">
      <ScrollView>
        <SafeAreaView style={styles.container}>
          <Image style={styles.enterWeb3} source={lang === Lang.zhHant ? EnterWeb3ZH : EnterWeb3EN} contentFit="contain" />
          <View style={styles.lottieAnimation}>
            <LottieAnimation />
          </View>
          <Button
            testID="Get Started"
            textAlign="left"
            Icon={ArrowRight}
            style={styles.btn}
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
    paddingTop: 92,
    paddingHorizontal: 16,
  },
  enterWeb3: {
    alignSelf: 'center',
    width: 232,
    height: 100,
  },
  firstText: {
    width: 198,
    aspectRatio: 4.5,
  },
  lottieAnimation: {
    alignSelf: 'center',
    width: 352,
    height: 352,
    marginTop: 52,
  },
  btn: {
    marginTop: 45,
    marginBottom: 32,
  },
});

export default Welcome;

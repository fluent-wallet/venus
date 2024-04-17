import React from 'react';
import { ImageBackground, View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Button from '@components/Button';
import { WelcomeStackName, WayToInitWalletStackName, type StackScreenProps } from '@router/configs';
import { Lang, useLanguage } from '@hooks/useI18n';
import ArrowRight from '@assets/icons/arrow-right.svg';
import EnterWeb3EN from '@assets/images/enter-web3-en.webp';
import EnterWeb3ZH from '@assets/images/enter-web3-zh.webp';
import WelcomeBgDark from '@assets/images/welcome-bg-dark.webp';
import LottieAnimation from './lottie';

const Welcome: React.FC<StackScreenProps<typeof WelcomeStackName>> = ({ navigation }) => {
  const { t } = useTranslation();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground source={WelcomeBgDark} style={styles.bg} resizeMode="cover">
      <ScrollView>
        <View style={{ paddingTop: insets.top, paddingRight: insets.right, paddingLeft: insets.left, paddingBottom: insets.bottom }}>
          <View style={styles.container}>
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
          </View>
        </View>
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

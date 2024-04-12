import React, { useCallback, useRef } from 'react';
import { ImageBackground, ScrollView, Keyboard, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import plugins from '@core/WalletCore/Plugins';
import { WayToInitWalletStackName, BiometricsWayStackName, type StackScreenProps } from '@router/configs';
import useInAsync from '@hooks/useInAsync';
import { Lang, useLanguage } from '@hooks/useI18n';
import ArrowRight from '@assets/icons/arrow-right.svg';
import WelcomeSwiftShieldEN from '@assets/images/welcome-SwiftShield-en.webp';
import WelcomeSwiftShieldZH from '@assets/images/welcome-SwiftShield-zh.webp';
import WelcomeBgDark from '@assets/images/welcome-bg-dark.webp';
import i18n from '@assets/i18n';
import LottieAnimation from './lottie';
import ImportExistingWallet, { type BottomSheetMethods } from './ImportExistingWallet';

export const showNotFindBSIMCardMessage = () =>
  showMessage({
    message: i18n.t('welcome.error.BSIM.notFInd.title'),
    description: i18n.t('welcome.error.BSIM.notFInd.describe'),
    type: 'failed',
  });

const WayToInitWallet: React.FC<StackScreenProps<typeof WayToInitWalletStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useLanguage();

  const _handleConnectBSIMCard = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      await new Promise((resolve) => setTimeout(resolve));
      await plugins.BSIM.getBSIMVersion();
      navigation.navigate(BiometricsWayStackName, { type: 'connectBSIM' });
    } catch (error) {
      showNotFindBSIMCardMessage();
    } finally {
      navigation.setOptions({ gestureEnabled: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { inAsync: inConnecting, execAsync: handleConnectBSIMCard } = useInAsync(_handleConnectBSIMCard);

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  return (
    <>
      <ImageBackground source={WelcomeBgDark} style={styles.bg} resizeMode="cover">
        <ScrollView>
          <SafeAreaView style={styles.container}>
            {/* <Image style={styles.img} source={ImgNew} contentFit="contain" /> */}
            <View style={styles.lottieAnimation}>
              <LottieAnimation />
            </View>
            <Image style={styles.welcomeSwiftShield} source={lang === Lang.zhHant ? WelcomeSwiftShieldZH : WelcomeSwiftShieldEN} contentFit="contain" />

            <Button
              testID="connectBSIMWallet"
              textAlign="left"
              Icon={ArrowRight}
              style={styles.btn}
              onPress={handleConnectBSIMCard}
              loading={inConnecting}
              mode="dark"
            >
              {t('welcome.connectBSIMWallet')}
            </Button>

            <Text style={[styles.orAddWith, { color: colors.textThird }]}>{t('welcome.addWith')}:</Text>

            <Button
              testID="createNewWallet"
              textAlign="left"
              style={styles.btn}
              onPress={() => navigation.navigate(BiometricsWayStackName, { type: 'createNewWallet' })}
              mode="dark"
            >
              {t('welcome.createNewWallet')}
            </Button>

            <Button testID="importExistingWallet" textAlign="left" style={styles.btnLast} onPress={() => bottomSheetRef.current?.expand()} mode="dark">
              {t('welcome.importExistingWallet')}
            </Button>
          </SafeAreaView>
        </ScrollView>
      </ImageBackground>
      <ImportExistingWallet
        bottomSheetRef={bottomSheetRef}
        onSuccessConfirm={(value) => {
          navigation.navigate(BiometricsWayStackName, { type: 'importExistWallet', value });
          if (Keyboard.isVisible()) {
            Keyboard.dismiss();
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  lottieAnimation: {
    alignSelf: 'center',
    width: 400,
    height: 400,
  },
  welcomeSwiftShield: {
    alignSelf: 'center',
    width: 333,
    aspectRatio: 3.36,
    marginBottom: 38,
  },
  orAddWith: {
    marginBottom: 16,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'left',
  },
  btn: {
    marginBottom: 16,
  },
  btnLast: {},
});

export default WayToInitWallet;

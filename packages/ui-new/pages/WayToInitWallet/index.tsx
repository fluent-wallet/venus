import i18n from '@assets/i18n';
import ArrowRight from '@assets/icons/arrow-right.svg';
import WelcomeBgDark from '@assets/images/welcome-bg-dark.webp';
import WelcomeSwiftShieldEN from '@assets/images/welcome-SwiftShield-en.webp';
import WelcomeSwiftShieldZH from '@assets/images/welcome-SwiftShield-zh.webp';
import type { BottomSheetMethods } from '@components/BottomSheet';
import BSIMDeviceSelectSheet from '@components/BSIM/BSIMDeviceSelectSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { isRecoveryModeError } from '@core/hardware/bsim/errors';
import { Lang, useLanguage } from '@hooks/useI18n';
import useInAsync from '@hooks/useInAsync';
import { useTheme } from '@react-navigation/native';
import { BiometricsWayStackName, ChangeBPinStackName, RecoverBsimStackName, type StackScreenProps, type WayToInitWalletStackName } from '@router/configs';
import { getHardwareWalletService } from '@service/core';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, Keyboard, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImportExistingWallet from './ImportExistingWallet';
import LottieAnimation from './lottie';

export const showNotFindBSIMCardMessage = () =>
  showMessage({
    message: i18n.t('welcome.error.BSIM.notFInd.title'),
    description: i18n.t('welcome.error.BSIM.notFInd.describe'),
    type: 'failed',
  });

const WayToInitWallet: React.FC<StackScreenProps<typeof WayToInitWalletStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLanguage();

  const _handleConnectBSIMCard = useCallback(async (bsimDeviceId?: string | unknown) => {
    const deviceIdentifier = typeof bsimDeviceId === 'string' ? bsimDeviceId : undefined;
    try {
      navigation.setOptions({ gestureEnabled: false });
      await new Promise((resolve) => setTimeout(resolve));

      try {
        // Detection only: connect + list without deriving new accounts.
        await getHardwareWalletService().connectAndList(HARDWARE_WALLET_TYPES.BSIM, { deviceIdentifier });
      } catch (error) {
        // Only recovery mode should navigate to Recover flow.
        if (isRecoveryModeError(error)) {
          return navigation.navigate(RecoverBsimStackName, { bsimDeviceId: deviceIdentifier });
        }
        throw error;
      }

      navigation.navigate(ChangeBPinStackName, { bsimDeviceId: deviceIdentifier });
    } catch (error: any) {
      if (handleBSIMHardwareUnavailable(error, navigation)) {
        return;
      }
      showNotFindBSIMCardMessage();
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { inAsync: inConnecting, execAsync: handleConnectBSIMCard } = useInAsync(_handleConnectBSIMCard);

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const bsimDeviceSheetRef = useRef<BottomSheetMethods>(null!);
  return (
    <>
      <ImageBackground source={WelcomeBgDark} style={styles.bg} resizeMode="cover">
        <ScrollView>
          <View style={{ paddingTop: insets.top, paddingRight: insets.right, paddingLeft: insets.left, paddingBottom: insets.bottom }}>
            <View style={styles.container}>
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
                onPress={Platform.OS === 'ios' ? () => bsimDeviceSheetRef.current?.expand() : () => handleConnectBSIMCard()}
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
                onPress={() => navigation.navigate(BiometricsWayStackName, { kind: 'create_hd' })}
                mode="dark"
              >
                {t('welcome.createNewWallet')}
              </Button>

              <Button testID="importExistingWallet" textAlign="left" style={styles.btnLast} onPress={() => bottomSheetRef.current?.expand()} mode="dark">
                {t('welcome.importExistingWallet')}
              </Button>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
      <ImportExistingWallet
        bottomSheetRef={bottomSheetRef}
        onSuccessConfirm={(request) => {
          navigation.navigate(BiometricsWayStackName, request);
          if (Keyboard.isVisible()) {
            Keyboard.dismiss();
          }
        }}
      />

      <BSIMDeviceSelectSheet
        bottomSheetRef={bsimDeviceSheetRef}
        onConnect={handleConnectBSIMCard}
        onScanError={(error) => {
          if (handleBSIMHardwareUnavailable(error, navigation)) return;
          showNotFindBSIMCardMessage();
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

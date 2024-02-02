import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableHighlight } from 'react-native';
import { useTheme, CommonActions } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { Image } from 'expo-image';
import plugins from '@core/WalletCore/Plugins';
import useInAsync from '@hooks/useInAsync';
import Text from '@components/Text';
import Button from '@components/Button';
import { BiometricsWayStackName, PasswordWayStackName, HomeStackName, type StackScreenProps } from '@router/configs';
import Img from '@assets/images/welcome-img.webp';
import createVault from './createVaultWithRouterParams';

export const showBiometricsDisabledMessage = () => {
  showMessage({
    message: 'Device biometrics not enabled',
    description: 'Please enable your biometrics in device settings.',
    type: 'warning',
  });
};

const BiometricsWay: React.FC<StackScreenProps<typeof BiometricsWayStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();

  const _handleEnableBiometrics = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      const supportedBiometryType = await plugins.Authentication.getSupportedBiometryType();
      if (supportedBiometryType === null) {
        showBiometricsDisabledMessage();
        return;
      }
      await plugins.Authentication.setPassword({ authType: plugins.Authentication.AuthenticationType.Biometrics });
      if (await createVault(route.params)) {
        navigation.navigate(HomeStackName);
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
      }
    } catch (err) {
      console.error('Enable Biometrics error: ', err);
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { inAsync, execAsync: handleEnableBiometrics } = useInAsync(_handleEnableBiometrics);

  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>🖐️ Enable Fingerprint</Text>
      <Image style={styles.img} source={Img} contentFit="contain" />

      <Text style={[styles.description, { color: colors.textPrimary }]}>
        Enable <Text style={{ color: colors.textNotice, fontWeight: '600' }}>Fingerprint</Text> to access wallet.
        {'\n\n'}
        After enabled, you can unlock wallets or make transactions by verifying your{' '}
        <Text style={{ color: colors.textNotice, fontWeight: '600' }}>Fingerprint</Text>.
      </Text>

      <Button testID="enable" style={styles.btnEnable} mode="auto" loading={inAsync} onPress={handleEnableBiometrics}>
        Enable
      </Button>

      <TouchableHighlight underlayColor={colors.underlay} style={styles.gotoSetpwd} onPress={() => navigation.navigate(PasswordWayStackName)}>
        <Text style={[styles.gotoSetpwdText, { color: colors.textPrimary }]}>Set Password</Text>
      </TouchableHighlight>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'left',
  },
  img: {
    width: 240,
    aspectRatio: 1,
    marginTop: 24,
    marginBottom: 60,
    alignSelf: 'center',
  },
  description: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  btnEnable: {
    marginTop: 80,
    marginBottom: 4,
  },
  gotoSetpwd: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gotoSetpwdText: {
    fontSize: 16,
    fontWeight: '300',
  },
});

export default BiometricsWay;

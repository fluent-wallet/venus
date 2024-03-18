import React, { useState, useCallback, useRef, type MutableRefObject, useEffect } from 'react';
import { useTheme, StackActions } from '@react-navigation/native';
import { View, Linking, StyleSheet } from 'react-native';
import { useCameraPermission, useCameraDevice, useCameraFormat, Camera, type Code } from 'react-native-vision-camera';
import { showMessage } from 'react-native-flash-message';
import * as ImagePicker from 'expo-image-picker';
import composeRef from '@cfx-kit/react-utils/dist/composeRef';
import { parseUri } from '@walletconnect/utils';
import { useCurrentNetwork, NetworkType } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import { ScanQRCodeStackName, type StackScreenProps } from '@router/configs';
import { parseETHURL, type ETHURL } from '@utils/ETHURL';
import { ENABLE_WALLET_CONNECT_FEATURE } from '@utils/features';
import ScanBorder from '@assets/icons/scan-border.svg';

// has onConfirm props means open in SendTranscation with local modal way.
interface Props {
  onConfirm?: (ethUrl: ETHURL) => void;
  bottomSheetRefOuter?: MutableRefObject<BottomSheetMethods>;
  navigation?: StackScreenProps<typeof ScanQRCodeStackName>['navigation'];
}

const scanAreaWidth = 220;
const ScanQrCode: React.FC<Props> = ({ navigation, bottomSheetRefOuter, onConfirm }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetwork = useCurrentNetwork()!;

  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ fps: 30 }]);
  const [scanStatus, setScanStatus] = useState<'Pending' | 'Parsing' | { errorMessage: string }>('Pending');

  const { hasPermission, requestPermission } = useCameraPermission();
  const [hasRejectPermission, setHasRejectPermission] = useState(false);

  const onParseEthUrlSuccess = useCallback(
    (ethUrl: ETHURL) => {
      if (onConfirm) {
        onConfirm(ethUrl);
        bottomSheetRef.current?.close();
        return;
      } else {
        // return navigation.dispatch(StackActions.replace(ReceiveAddressStackName, { to: ethAddress }));
      }
    },
    [onConfirm, navigation],
  );

  const handleCodeScan = useCallback(
    async (codes: Code[]) => {
      const code = codes[0];
      if (!code || scanStatus === 'Parsing') return;
      if (!code.value) return;
      let ethUrl: ETHURL;
      if (await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: code.value })) {
        ethUrl = { target_address: code.value, schema_prefix: currentNetwork.networkType === NetworkType.Ethereum ? 'ethereum:' : 'conflux:' } as ETHURL;
        onParseEthUrlSuccess(ethUrl);
        return;
      }
      try {
        ethUrl = parseETHURL(code.value);
        onParseEthUrlSuccess(ethUrl);
      } catch (err) {
        if (!onConfirm && code.value.startsWith('wc:') && ENABLE_WALLET_CONNECT_FEATURE.allow) {
          try {
            const { version } = parseUri(code.value);
            if (version === 1) {
              setScanStatus({ errorMessage: 'Sorry, The OR code version is to low' });
            } else {
              await plugins.WalletConnect.pair(code.value);
              // navigation.dispatch(StackActions.replace(HomeStackName, { screen: WalletStackName }));
            }
          } catch (err) {
            showMessage({
              message: 'Connect to wallet-connect failed',
              description: String(err ?? ''),
              duration: 3000,
            });
            setScanStatus({ errorMessage: `Connect to wallet-connect failed: ${String(err ?? '')}` });
          }
        } else {
          setScanStatus({ errorMessage: 'Sorry, this QR code could not be recognized.' });
        }
      }
    },
    [currentNetwork?.networkType, onConfirm, onParseEthUrlSuccess, scanStatus],
  );

  const pickImage = useCallback(async () => {
    // No permissions request is necessary for launching the image library
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log(result);

    if (!result.canceled) {
      console.log(result);
    }
  }, []);

  const handleOnChange = useCallback((index: number) => {
    if (index === 0) {
      setScanStatus('Pending');
      if (!hasPermission) {
        const execRequestPermission = async () => {
          const isSuccess = await requestPermission();
          if (!isSuccess) {
            setHasRejectPermission(true);
          }
        };
        execRequestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!onConfirm) {
      if (!hasPermission) {
        const execRequestPermission = async () => {
          const isSuccess = await requestPermission();
          if (!isSuccess) {
            setHasRejectPermission(true);
          }
        };
        execRequestPermission();
      }
    }
  }, []);

  return (
    <BottomSheet
      ref={bottomSheetRefOuter ? composeRef([bottomSheetRef, bottomSheetRefOuter]) : bottomSheetRef}
      snapPoints={snapPoints.large}
      index={!onConfirm ? 0 : undefined}
      isModal={!!onConfirm}
      onChange={!onConfirm ? undefined : handleOnChange}
      onClose={!onConfirm ? navigation?.goBack : undefined}
    >
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Scan</Text>
        {hasPermission && (
          <>
            {device && (
              <>
                <View style={styles.cameraWrapper}>
                  <Camera
                    ref={camera}
                    isActive={scanStatus !== 'Pending'}
                    device={device}
                    codeScanner={{
                      codeTypes: ['qr', 'ean-13'],
                      onCodeScanned: handleCodeScan,
                    }}
                    style={styles.camera}
                    format={format}
                    enableZoomGesture
                  />
                </View>
                <ScanBorder style={styles.scanBorder} color={colors.borderFourth} pointerEvents="none" />
                {typeof scanStatus === 'object' && scanStatus.errorMessage && (
                  <Text style={[styles.errorMessage, { color: colors.down }]}>{scanStatus.errorMessage}</Text>
                )}
                <Button style={styles.photos} onPress={pickImage}>
                  Photos
                </Button>
              </>
            )}
          </>
        )}
        {!hasPermission && (
          <>
            {!hasRejectPermission && (
              <>
                <Text style={[styles.tip, { color: colors.down, marginBottom: 8 }]}>Wallet Requires Access</Text>
                <Text style={[styles.tip, { color: colors.textPrimary }]}>Please allow SwiftShield wallet to use camera permissions to scan the QR code.</Text>
              </>
            )}
            {hasRejectPermission && (
              <>
                <Text style={[styles.tip, { color: colors.textPrimary, marginBottom: 8 }]}>Camera permission not granted for this app</Text>
                <Text style={[styles.tip, { color: colors.textPrimary }]}>
                  Unable to scan. Please <Text style={{ color: colors.down }}>open Camera</Text> in the system permission.
                </Text>
                <View style={styles.btnArea}>
                  <Button style={styles.btn} onPress={() => (!onConfirm ? bottomSheetRef.current?.close() : bottomSheetRef.current?.dismiss())}>
                    Dismiss
                  </Button>
                  <Button
                    style={styles.btn}
                    onPress={() => {
                      Linking.openSettings();
                    }}
                  >
                    Open settings
                  </Button>
                </View>
              </>
            )}
          </>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  title: {
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  scanBorder: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
  },
  cameraWrapper: {
    marginTop: 56,
    width: scanAreaWidth,
    height: scanAreaWidth,
    alignSelf: 'center',
    borderRadius: 6,
    overflow: 'hidden',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  errorMessage: {
    marginTop: 48,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  photos: {
    width: 180,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 80,
  },
  tip: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  btnArea: {
    marginTop: 'auto',
    marginBottom: 80,
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default ScanQrCode;

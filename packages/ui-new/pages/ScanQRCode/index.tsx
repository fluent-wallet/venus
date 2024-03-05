import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme, StackActions } from '@react-navigation/native';
import { Pressable, View, Linking, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useCameraPermission, useCameraDevice, useCameraFormat, Camera, type Point, type Code } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { showMessage } from 'react-native-flash-message';
import { parseUri } from '@walletconnect/utils';
import { useAssetsTokenList, useCurrentAddress, useCurrentNetwork, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { type WalletTransactionType } from '@core/WalletCore/Methods/transactionMethod';
import BottomSheet, { snapPoints } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import { ScanQRCodeStackName, SendTranscationStackName, type StackScreenProps } from '@router/configs';
import { screenWidth } from '@utils/deviceInfo';
import { parseETHURL, type ETHURL } from '@utils/ETHURL';
import { ENABLE_WALLET_CONNECT_FEATURE } from '@utils/features';

const scanAreaTop = 50;
const scanAreaWidth = 250;

const ScanQrCode: React.FC<StackScreenProps<typeof ScanQRCodeStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const currentAddress = useCurrentAddress()!;
  const currentNetwork = useCurrentNetwork()!;
  const tokens = useAssetsTokenList();

  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ fps: 30 }]);
  const isScanningInProgress = useRef(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [hasRejectPermission, setHasRejectPermission] = useState(false);

  const handleScanETHURL = useCallback(
    (url: string) => {
      let ethURL: ETHURL;
      try {
        ethURL = parseETHURL(url);
      } catch (error) {
        return showMessage({
          message: 'Invalid QR code',
        });
      }

      const { target_address, chain_id, function_name, parameters } = ethURL;

      if (!tokens || tokens.length === 0) {
        return showMessage({
          message: `Wait for loading assets...`,
          type: 'warning',
        });
      }

      if (!function_name) {
        // if don't have function then  send native token
        // is send native token and have value
        const token = tokens.find((t) => t.type === AssetType.Native);
        if (!token) {
          return showMessage({
            message: `Looks like you don't have that asset in your wallet.`,
            type: 'warning',
          });
        }
        const txParams: WalletTransactionType = {
          from: currentAddress?.hex,
          to: target_address,
          assetType: token.type,
          balance: token.balance,
          symbol: token.symbol,
          decimals: token.decimals,
          contractAddress: token.contractAddress,
          iconUrl: token.icon,
          priceInUSDT: token.priceInUSDT,
          amount: '0',
        };

        if (parameters && typeof parameters.value !== 'undefined') {
          txParams.amount = parameters.value.toString();
          return;
          // return navigation.dispatch(StackActions.replace(SendToStackName, txParams));
        }
      } else if (function_name === 'transfer') {
        // send 20 token
        // check is has uint256
        if (!parameters || !parameters.address) {
          return showMessage({
            message: 'Invalid QR code',
            type: 'warning',
          });
        }

        //  is send 20 token and have value
        const token = tokens.find((t) => t.contractAddress?.toLowerCase() === parameters.address?.toLowerCase());
        if (!token) {
          return showMessage({
            message: `Looks like you don't have that asset in your wallet.`,
            type: 'warning',
          });
        }

        const txParams: WalletTransactionType = {
          from: currentAddress?.hex,
          to: target_address,
          assetType: token.type,
          balance: token.balance,
          symbol: token.symbol,
          decimals: token.decimals,
          contractAddress: token.contractAddress,
          iconUrl: token.icon,
          priceInUSDT: token.priceInUSDT,
          amount: '0',
        };

        if (parameters.uint256) {
          txParams.amount = parameters.uint256.toString();
        }

        return;
        // return navigation.dispatch(StackActions.replace(SendToStackName, txParams));
      } else {
        return showMessage({
          message: `This action is currently not supported`,
        });
      }

      // default go to receive address
      return;
      // return navigation.dispatch(StackActions.replace(ReceiveAddressStackName, { to: target_address }));
    },
    [navigation, tokens, currentAddress?.hex],
  );

  const handleCodeScan = async (code: Code) => {
    if (!code || isScanningInProgress.current) return;
    if (!code.value) return;
    isScanningInProgress.current = true;

    if (await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: code.value })) {
      isScanningInProgress.current = false;
      return;
      // return navigation.dispatch(StackActions.replace(ReceiveAddressStackName, { to: ethAddress }));
    }

    // check is EIP 681
    // maybe we also need support EIP 83
    if (code.value.startsWith('ethereum:')) {
      isScanningInProgress.current = false;
      return handleScanETHURL(code.value);
    }

    if (code.value.startsWith('wc:') && ENABLE_WALLET_CONNECT_FEATURE.allow) {
      isScanningInProgress.current = false;
      try {
        const { version } = parseUri(code.value);
        if (version === 1)
          return showMessage({
            message: 'Sorry, The OR code version is to low',
          });
        await plugins.WalletConnect.pair(code.value);
        // navigation.dispatch(StackActions.replace(HomeStackName, { screen: WalletStackName }));
        isScanningInProgress.current = false;
      } catch (err) {
        showMessage({
          message: 'Connect to wallet-connect failed',
          description: String(err ?? ''),
          duration: 3000,
        });
        isScanningInProgress.current = false;
      }
      return;
    }

    isScanningInProgress.current = false;
    return showMessage({
      message: 'Sorry, this QR code could not be recognized.',
    });
  };

  const focus = useCallback((point: Point) => {
    if (camera.current === null) return;
    camera.current.focus(point);
  }, []);

  const gesture = Gesture.Tap().onEnd(() => {
    runOnJS(() => focus({ x: screenWidth / 2, y: 250 }));
  });

  useEffect(() => {
    if (!hasPermission) {
      const execRequestPermission = async () => {
        const isSuccess = await requestPermission();
        if (!isSuccess) {
          setHasRejectPermission(true);
        }
      };
      execRequestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BottomSheet snapPoints={snapPoints.large} index={0} isModal={false} onClose={navigation.goBack}>
      <View style={styles.container}>
        {hasPermission && (
          <>
            {device && (
              <GestureDetector gesture={gesture}>
                <Camera
                  ref={camera}
                  isActive={true}
                  device={device}
                  codeScanner={{
                    codeTypes: ['qr', 'ean-13'],
                    onCodeScanned: (code) => {
                      if (code[0].value) {
                        handleCodeScan(code[0]);
                      }
                    },
                  }}
                  style={{ flex: 1 }}
                  format={format}
                  enableZoomGesture
                />
              </GestureDetector>
            )}
            
            <View style={[styles.overlay, styles.container]}>
              <View style={[styles.overlayTop, { backgroundColor: colors.bgPrimary }]} pointerEvents="box-none" />
              <View style={[styles.overlayBottom, { backgroundColor: colors.bgSecondary }]} pointerEvents="box-none" />
              <View style={[styles.overlayLeft, { backgroundColor: colors.bgPrimary }]} pointerEvents="box-none" />
              <View style={[styles.overlayRight, { backgroundColor: colors.bgPrimary }]} pointerEvents="box-none" />
              <Text style={[styles.title, { color: colors.textPrimary }]}>Scan</Text>
            </View>
          </>
        )}
        {!hasPermission && (
          <>
            {!hasRejectPermission && (
              <>
                <Text>Wallet Requires Access</Text>
                <Text>Please allow SwiftShield wallet to use camera permissions to scan the QR code.</Text>
              </>
            )}
            {hasRejectPermission && (
              <>
                <Text>Camera permission not granted for this app</Text>
                <Text>Unable to scan. Please open Camera in the system permission.</Text>
                <View>
                  <Button
                    onPress={() => {
                      navigation.goBack();
                    }}
                  >
                    Dismiss
                  </Button>
                  <Button
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
  },
  title: {
    marginTop: 8,
    marginBottom: 0,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  overlayTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: scanAreaTop,
    opacity: 95,
  },
  overlayLeft: {
    position: 'absolute',
    left: 0,
    width: (screenWidth - scanAreaWidth) / 2,
    top: scanAreaTop,
    height: scanAreaWidth,
    opacity: 95,
  },
  overlayRight: {
    position: 'absolute',
    left: scanAreaWidth + (screenWidth - scanAreaWidth) / 2,
    width: (screenWidth - scanAreaWidth) / 2,
    top: scanAreaTop,
    height: scanAreaWidth,
    opacity: 95,
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: scanAreaTop + scanAreaWidth,
    height: 400,
    bottom: 0,
    opacity: 95,
  },
});

export default ScanQrCode;

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Pressable, SafeAreaView, View, Linking, Dimensions, StatusBar } from 'react-native';
import { RouteProp, StackActions } from '@react-navigation/native';
import {
  useCameraPermission,
  useCameraDevice,
  useCodeScanner,
  useCameraFormat,
  Camera,
  CodeScannerFrame,
  type Point,
  type Code,
} from 'react-native-vision-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Icon, Text, useTheme, Overlay, Button } from '@rneui/themed';
import { HomeStackName, ReceiveAddressStackName, RootStackList, ScanQRCodeStackName, SendToStackName, StackNavigation, WalletStackName } from '@router/configs';
import { useAssetsTokenList } from '@core/WalletCore/Plugins/ReactInject/data/useAssets';
import { useAtom } from 'jotai';
import { setTokenTransaction, setTransactionAmount, setTransactionTo } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { AssetType } from '@core/database/models/Asset';
import plugins from '@core/WalletCore/Plugins';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { BaseButton } from '@components/Button';
import { parseETHURL, type ETHURL } from '@utils/ETHURL';
import { isHexAddress } from '@core/utils/account';
import { statusBarHeight } from '@utils/deviceInfo';
import { showMessage } from 'react-native-flash-message';
import { isAddress } from 'ethers';
import { parseUri } from '@walletconnect/utils';
import { ENABLE_WALLET_CONNECT_FEATURE } from '@utils/features';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const scanAreaWidth = 250;

const ScanQRCode: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof ScanQRCodeStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();

  const camera = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ fps: 30 }]);
  const isScanningInProgress = useRef(false);

  const [showPermissionModel, setShowPermissionModel] = useState(!hasPermission);
  const [showRejectPermissionModel, setShowRejectPermissionModel] = useState(false);

  const [, setTXTo] = useAtom(setTransactionTo);
  const [, setTokenTX] = useAtom(setTokenTransaction);
  const [, setTXAmount] = useAtom(setTransactionAmount);
  const tokens = useAssetsTokenList();

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

      setTXTo(target_address);
      if (!tokens || tokens.length === 0) {
        return showMessage({
          message: `Looks like you don't have that asset in your wallet.`,
        });
      }

      if (!function_name) {
        // if don't have function then  send native token
        // is send native token and have value
        const token = tokens.find((t) => t.type === AssetType.Native);
        if (!token) {
          return showMessage({
            message: `Looks like you don't have that asset in your wallet.`,
          });
        }

        setTokenTX({
          assetType: token.type,
          balance: token.balance,
          symbol: token.symbol,
          decimals: token.decimals,
          contractAddress: token.contractAddress,
          iconUrl: token.icon,
          priceInUSDT: token.priceInUSDT,
        });

        if (parameters && typeof parameters.value !== 'undefined') {
          setTXAmount(parameters.value);
          return navigation.dispatch(StackActions.replace(SendToStackName));
        }
      } else if (function_name === 'transfer') {
        // send 20 token
        // check is has uint256
        if (!parameters || !parameters.address) {
          return showMessage({
            message: 'Invalid QR code',
          });
        }

        //  is send 20 token and have value
        const token = tokens.find((t) => t.contractAddress?.toLowerCase() === parameters.address?.toLowerCase());
        if (!token) {
          return showMessage({
            message: `Looks like you don't have that asset in your wallet.`,
          });
        }

        setTokenTX({
          assetType: token.type,
          balance: token.balance,
          symbol: token.symbol,
          decimals: token.decimals,
          contractAddress: token.contractAddress,
          iconUrl: token.icon,
          priceInUSDT: token.priceInUSDT,
        });

        if (parameters.uint256) {
          setTXAmount(parameters.uint256);
        }
        return navigation.dispatch(StackActions.replace(SendToStackName));
      } else {
        return showMessage({
          message: `This action is currently not supported`,
        });
      }

      // default go to receive address
      return navigation.dispatch(StackActions.replace(ReceiveAddressStackName));
    },
    [navigation, setTXAmount, setTXTo, setTokenTX, tokens],
  );

  const handleCodeScan = async (code: Code) => {
    if (!code || !isScanningInProgress) return;
    if (!code.value) return;
    isScanningInProgress.current = true;
    const ethAddress = code.value;
    if (ethAddress.startsWith('0x') && isAddress(ethAddress)) {
      isScanningInProgress.current = false;
      setTXTo(ethAddress);
      return navigation.dispatch(StackActions.replace(ReceiveAddressStackName));
    }

    // check is EIP 681
    // maybe we also need support EIP 831

    if (code.value.startsWith('ethereum:')) {
      isScanningInProgress.current = false;
      return handleScanETHURL(code.value);
    }

    if (!ENABLE_WALLET_CONNECT_FEATURE.allow) return;

    if (code.value.startsWith('wc:')) {
      isScanningInProgress.current = false;
      try {
        const { version } = parseUri(code.value);
        if (version === 1)
          return showMessage({
            message: 'Sorry, The OR code version is to low',
          });
        await plugins.WalletConnect.pair(code.value);
        navigation.dispatch(StackActions.replace(HomeStackName, { screen: WalletStackName }));
      } catch (err) {
        showMessage({
          message: 'Connect to wallet-connect failed',
          description: String(err ?? ''),
        });
      }
      return;
    }

    isScanningInProgress.current = false;

    return showMessage({
      message: 'Sorry, this QR code could not be recognized.',
    });
  };

  const handlePermission = useCallback(async () => {
    if (!hasPermission) {
      const isOk = await requestPermission();
      setShowPermissionModel(false);
      if (!isOk) {
        setShowRejectPermissionModel(true);
      }
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (hasPermission) {
      setShowPermissionModel(false);
    } else {
      setShowPermissionModel(true);
    }
  }, [hasPermission]);

  const focus = useCallback((point: Point) => {
    if (camera.current === null) return;
    camera.current.focus(point);
  }, []);

  const gesture = Gesture.Tap().onEnd(() => {
    runOnJS(() => focus({ x: screenWidth / 2, y: 250 }));
  });

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight }}>
      <StatusBar backgroundColor={theme.colors.pureBlackAndWight} />
      <>
        {hasPermission && device && device !== null && (
          <View className="flex-1">
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

            <View className="absolute w-full h-full left-0 top-0">
              <View
                className="absolute w-full h-[125px] left-0 top-0 opacity-95"
                pointerEvents="box-none"
                style={{ backgroundColor: theme.colors.pureBlackAndWight }}
              />
              <View
                className="absolute w-full left-0 top-0 opacity-95"
                pointerEvents="box-none"
                style={{ backgroundColor: theme.colors.pureBlackAndWight, top: 125 + scanAreaWidth, height: '100%' }}
              />
              <View
                className="absolute left-0 opacity-95"
                pointerEvents="box-none"
                style={{
                  backgroundColor: theme.colors.pureBlackAndWight,
                  top: 125,
                  width: (screenWidth - scanAreaWidth) / 2,
                  height: scanAreaWidth,
                }}
              />
              <View
                className="absolute right-0 opacity-95"
                pointerEvents="box-none"
                style={{
                  backgroundColor: theme.colors.pureBlackAndWight,
                  top: 125,
                  width: (screenWidth - scanAreaWidth) / 2,
                  height: scanAreaWidth,
                }}
              />
              <Pressable
                onPress={() => navigation.goBack()}
                style={{ backgroundColor: theme.colors.contrastWhiteAndBlack }}
                className="flex items-center justify-center absolute top-4 left-2 w-12 h-12 rounded-full z-10"
              >
                <Icon name="arrow-back" color={theme.colors.pureBlackAndWight} size={40} />
              </Pressable>
              {/* <BaseButton testID="Photos" containerStyle={{ marginTop: screenHeight - 200, marginHorizontal: 24 }} onPress={handleSelectImage}>
                Photos
              </BaseButton> */}
            </View>
          </View>
        )}
      </>
      <Overlay
        backdropStyle={{ backgroundColor: undefined }}
        overlayStyle={{ borderRadius: 10, backgroundColor: theme.colors.surfaceCard }}
        isVisible={showPermissionModel}
      >
        <View className="p-5 w-[270px]">
          <Text className="text-xl font-bold leading-tight mb-5">Wallet Requires Access</Text>
          <Text>Please allow SwiftShield wallet to use camera permissions to scan the QR code.</Text>
          <View className="flex flex-row py-4">
            <View className="flex-1 mr-2">
              <Button
                type="outline"
                buttonStyle={{ borderRadius: 7, borderWidth: 1, borderColor: theme.colors.textBrand, minHeight: 48 }}
                titleStyle={{ color: theme.colors.textBrand }}
                onPress={() => {
                  setShowPermissionModel(false);
                  navigation.goBack();
                }}
              >
                <Text className="text-sm" style={{ color: theme.colors.textBrand }}>
                  Deny
                </Text>
              </Button>
            </View>
            <View className="flex-1">
              <BaseButton buttonStyle={{ backgroundColor: theme.colors.surfaceBrand }} onPress={handlePermission}>
                <Text className="text-sm" style={{ color: theme.colors.textInvert }}>
                  OK
                </Text>
              </BaseButton>
            </View>
          </View>
        </View>
      </Overlay>
      <Overlay
        backdropStyle={{ backgroundColor: undefined }}
        isVisible={showRejectPermissionModel}
        overlayStyle={{ borderRadius: 10, backgroundColor: theme.colors.surfaceCard }}
      >
        <View className="p-5 w-[270px]">
          <Text className="text-xl font-bold leading-tight mb-5">Camera permission not granted for this app</Text>
          <Text>Unable to scan. Please open Camera in the system permission.</Text>
          <View className="flex flex-row py-4">
            <View className="flex-1 mr-2">
              <Button
                type="outline"
                buttonStyle={{ borderRadius: 40, borderWidth: 1, borderColor: theme.colors.textBrand }}
                titleStyle={{ color: theme.colors.textBrand }}
                onPress={() => {
                  setShowPermissionModel(false);
                  navigation.goBack();
                }}
              >
                <Text className="text-sm" style={{ color: theme.colors.textBrand }}>
                  Dismiss
                </Text>
              </Button>
            </View>
            <View className="flex-1">
              <BaseButton
                buttonStyle={{ backgroundColor: theme.colors.surfaceBrand }}
                onPress={() => {
                  setShowRejectPermissionModel(false);
                  Linking.openSettings();
                  setShowPermissionModel(true);
                }}
              >
                <Text className="text-sm" style={{ color: theme.colors.textInvert }}>
                  Open settings
                </Text>
              </BaseButton>
            </View>
          </View>
        </View>
      </Overlay>
    </SafeAreaView>
  );
};

export default ScanQRCode;

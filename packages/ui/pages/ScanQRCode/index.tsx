import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Pressable, SafeAreaView, View, Linking, Dimensions, StatusBar } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
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
import { setAtom } from '@core/WalletCore/Plugins/ReactInject';
import { ReceiveAddressStackName, RootStackList, ScanQRCodeStackName, SendToStackName, HomeStackName, WalletStackName, StackNavigation } from '@router/configs';
import { getAssetsTokenList } from '@core/WalletCore/Plugins/ReactInject/data/useAssets';
import { setTokenTransaction, setTransactionAmount, setTransactionTo } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { AssetType } from '@core/database/models/Asset';
import plugins from '@core/WalletCore/Plugins';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { BaseButton } from '@components/Button';
import { parseETHURL, type ETHURL } from '@utils/ETHURL';
import { isHexAddress } from '@core/utils/account';
import { statusBarHeight } from '@utils/deviceInfo';
import { showMessage } from 'react-native-flash-message';


const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const scanAreaWidth = 250;

const ScanQRCode: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof ScanQRCodeStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();

  const camera = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ fps: 30 }]);

  const [showPermissionModel, setShowPermissionModel] = useState(!hasPermission);
  const [showRejectPermissionModel, setShowRejectPermissionModel] = useState(false);

  const handleSelectImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo' });
    } catch (err) {
      console.log('handleSelectImage error: ', err);
    }
  }, []);

  const inHandleScanResult = useRef(false);
  const handleCodeScanned = useCallback(async (codes: Code[], frame: CodeScannerFrame) => {
    // there is multiple codes we need set user to select one
    const code = codes[0];
    if (!code || !code.value || inHandleScanResult.current) return;
    inHandleScanResult.current = true;

    if (code.value.startsWith('wc:')) {
      inHandleScanResult.current = false;
      try {
        await plugins.WalletConnect.pair(code.value);
        navigation.dispatch(StackActions.replace(HomeStackName, { screen: WalletStackName }));
      } catch (err) {
        showMessage({
          message: 'Connect to wallet-connect failed',
          description: String(err ?? ''),
          type: 'warning',
        });
      }
      return;
    } else {
      const ethUrl = { target_address: undefined, chain_id: undefined, function_name: undefined, parameters: undefined } as unknown as ETHURL;
      if (isHexAddress(code.value)) {
        ethUrl.target_address = code.value;
      } else {
        try {
          Object.assign(ethUrl, parseETHURL(code.value));
        } catch (_) {
          // console.log();
        }
      }

      if (!ethUrl.target_address) {
        inHandleScanResult.current = false;
        return;
      }
      setAtom(setTransactionTo, ethUrl.target_address);

      const tokens = getAssetsTokenList();
      if (!tokens || tokens.length === 0) {
        // if tokens is not ready, go to receive address
        inHandleScanResult.current = false;
        navigation.dispatch(StackActions.replace(ReceiveAddressStackName));
        return;
      }

      let token: AssetInfo | undefined = undefined;
      let amount: bigint | undefined = undefined;
      if (ethUrl.function_name === 'transfer' && ethUrl.parameters?.address) {
        token = tokens.find((t) => t.contractAddress?.toLowerCase() === ethUrl.parameters?.address?.toLowerCase());
        if (token && ethUrl.parameters.uint256) {
          amount = ethUrl.parameters.uint256;
        }
      } else {
        token = tokens.find((t) => t.type === AssetType.Native);
        if (token && ethUrl.parameters?.value) {
          amount = ethUrl.parameters.value;
        }
      }

      if (token && amount) {
        setAtom(setTokenTransaction, {
          assetType: token.type,
          balance: token.balance,
          symbol: token.symbol,
          decimals: token.decimals,
          contractAddress: token.contractAddress,
          iconUrl: token.icon,
          priceInUSDT: token.priceInUSDT,
        });
        setAtom(setTransactionAmount, amount);
        inHandleScanResult.current = false;
        navigation.dispatch(StackActions.replace(SendToStackName));
      } else {
        inHandleScanResult.current = false;
        navigation.dispatch(StackActions.replace(ReceiveAddressStackName));
      }
    }
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: handleCodeScanned,
  });

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
                <Camera ref={camera} isActive={true} device={device} codeScanner={codeScanner} style={{ flex: 1 }} format={format} enableZoomGesture />
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
              <BaseButton testID="Photos" containerStyle={{ marginTop: screenHeight - 200, marginHorizontal: 24 }} onPress={handleSelectImage}>
                Photos
              </BaseButton>
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

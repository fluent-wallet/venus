import { RouteProp } from '@react-navigation/native';
import { Icon, Text, useTheme, Overlay, Button } from '@rneui/themed';
import { ReceiveAddressStackName, RootStackList, ScanQRCodeStackName, SendToStackName, StackNavigation } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, View } from 'react-native';
import { useCameraPermission, useCameraDevice, Camera, type Code, CodeScannerFrame } from 'react-native-vision-camera';
import { StackActions } from '@react-navigation/native';
import { BaseButton } from '@components/Button';
import { Linking } from 'react-native';
import { ETHURL, parseETHURL } from '@utils/ETHURL';
import { useAssetsTokenList } from '@core/WalletCore/Plugins/ReactInject/data/useAssets';
import { useAtom } from 'jotai';
import { setTokenTransaction, setTransactionAmount, setTransactionTo } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { formatEther, formatUnits, parseUnits } from 'ethers';
import { AssetType } from '@core/database/models/Asset';

const ScanQRCode: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof ScanQRCodeStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [showPermissionModel, setShowPermissionModel] = useState(!hasPermission);
  const [showRejectPermissionModel, setShowRejectPermissionModel] = useState(false);

  const [, setTXTo] = useAtom(setTransactionTo);
  const [, setTokenTX] = useAtom(setTokenTransaction);
  const [, setTXAmount] = useAtom(setTransactionAmount);
  const tokens = useAssetsTokenList();

  const [codes, setCodes] = useState<Code[]>([]);

  const handleCodeScanned = (codes: Code[], frame: CodeScannerFrame) => {
    // there is multiple codes we need set user to select one
    const code = codes[0];
    if (code && code.value) {
      try {
        const res = parseETHURL(code.value);
        console.log('res', res);
        const { target_address, chain_id, function_name, parameters } = res;
        // check is send 20 token
        if (function_name && function_name === 'transfer') {
          // check is has uint256
          if (parameters && parameters.uint256 && parameters.address) {
            //  is send 20 token and have value
            if (tokens && tokens.length > 0) {
              const token = tokens.find((t) => t.contractAddress?.toLowerCase() === parameters.address?.toLowerCase());
              if (token) {
                setTXTo(target_address);
                setTXAmount(Number(formatUnits(parameters.uint256, token.decimals)));
                setTokenTX({
                  assetType: token.type,
                  balance: token.balance,
                  symbol: token.symbol,
                  decimals: token.decimals,
                  contractAddress: token.contractAddress,
                  iconUrl: token.icon,
                  priceInUSDT: token.priceInUSDT,
                });

                return navigation.dispatch(StackActions.replace(SendToStackName));
              }

              setTXTo(target_address);
              return navigation.dispatch(StackActions.replace(ReceiveAddressStackName, { address: code.value }));
            }
          }
        } else {
          // send native token
          if (parameters && parameters.value) {
            // is send native token and have value
            if (tokens) {
              const token = tokens.find((t) => t.type === AssetType.Native);
              if (token) {
                setTXTo(target_address);
                setTXAmount(parseUnits(parameters.value.toString(), token.decimals));
                setTokenTX({
                  assetType: token.type,
                  balance: token.balance,
                  symbol: token.symbol,
                  decimals: token.decimals,
                  contractAddress: token.contractAddress,
                  iconUrl: token.icon,
                  priceInUSDT: token.priceInUSDT,
                });

                return navigation.dispatch(StackActions.replace(SendToStackName));
              }
            }
            setTXTo(target_address);
            return navigation.dispatch(StackActions.replace(ReceiveAddressStackName, { address: code.value }));
          }
        }
      } catch (error) {
        // todo add error message
        console.log(code.value);
        console.log(error);
      }
    }
  };

  const handlePermission = useCallback(async () => {
    if (!hasPermission) {
      const isOk = await requestPermission();
      console.log('get permission', isOk);
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

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight }}>
      <View className="flex-1" style={{ backgroundColor: theme.colors.pureBlackAndWight }}>
        {hasPermission && device && device !== null && (
          <View className="flex-1">
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ backgroundColor: theme.colors.contrastWhiteAndBlack }}
              className="flex items-center justify-center absolute top-4 left-2 w-12 h-12 rounded-full z-10"
            >
              <Icon name="arrow-back" color={theme.colors.pureBlackAndWight} size={40} />
            </Pressable>
            {/* {codes.length > 0 && (
              <View className=" absolute top-0 right-0 bottom-0 left-0 z-10" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                {codes.map((code, index) => (
                  <Pressable
                    key={index}
                    className="absolute z-10"
                    style={{
                      left: code?.frame?.x && code?.frame.y ? (Platform.OS === 'android' ? code?.frame?.x : code.frame.x) : undefined,
                      top: code?.frame?.x && code?.frame.y ? (Platform.OS === 'android' ? code?.frame?.y : code.frame.y) : undefined,
                    }}
                  >
                    <Icon name="keyboard-double-arrow-right" color={theme.colors.white} size={40} />
                  </Pressable>
                ))}
              </View>
            )} */}
            {device && (
              <Camera
                isActive={true}
                device={device}
                codeScanner={{
                  codeTypes: ['qr', 'ean-13'],
                  onCodeScanned: handleCodeScanned,
                }}
                style={{ flex: 1 }}
                fps={30}
              />
            )}
          </View>
        )}
      </View>
      <Overlay
        backdropStyle={{ backgroundColor: undefined }}
        overlayStyle={{ borderRadius: 10, backgroundColor: theme.colors.surfaceCard }}
        isVisible={showPermissionModel}
      >
        <View className="p-5 w-[270px]">
          <Text className="text-xl font-bold leading-tight mb-5">Wallet Requires Access</Text>
          <Text>Please allow BSIM wallet to use camera permissions to scan the QR code.</Text>
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

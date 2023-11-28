import { RouteProp } from '@react-navigation/native';
import { Icon, Text, useTheme } from '@rneui/themed';
import { RootStackList, ScanQRCodeStackName, StackNavigation } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, View } from 'react-native';
import { useCameraPermission, useCameraDevice, Camera, type Code, CodeScannerFrame } from 'react-native-vision-camera';
import { StackActions } from '@react-navigation/native';

const ScanQRCode: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof ScanQRCodeStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isActive, setIsActive] = useState(true);

  const [codes, setCodes] = useState<Code[]>([]);
  const handleCodeScanned = (codes: Code[], frame: CodeScannerFrame) => {
    // there is multiple codes we need set user to select one
    const code = codes[0];
    navigation.dispatch(StackActions.replace(route.params.path, { address: code.value }));
  };
  ``;
  useEffect(() => {
    async function checkPermission() {
      if (!hasPermission) {
        const isOk = await requestPermission();
        // Todo show permission dialog in get permission failed
      }
    }
    checkPermission();
  }, []);

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight }}>
      <View className="flex-1" style={{ backgroundColor: theme.colors.black }}>
        {hasPermission && device && device !== null && (
          <View className="flex-1">
            <Pressable
              onPress={() => navigation.goBack()}
              className="flex items-center justify-center absolute top-4 left-2 w-12 h-12 rounded-full bg-black z-10"
            >
              <Icon name="arrow-back" color={theme.colors.white} size={40} />
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
                isActive={isActive}
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
    </SafeAreaView>
  );
};

export default ScanQRCode;

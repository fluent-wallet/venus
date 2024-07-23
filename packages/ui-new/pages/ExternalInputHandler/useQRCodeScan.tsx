import { launchImageLibraryAsync } from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, Camera } from 'expo-camera';

interface Params {
  style: StyleProp<ViewStyle>;
  onSuccess: (data: string) => void;
  onFailed: () => void;
  isParsingRef: React.MutableRefObject<boolean>;
}

const useQRCodeScan = ({ style, onSuccess, onFailed, isParsingRef }: Params) => {
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [hasRejectCameraPermission, setHasRejectCameraPermission] = useState(false);

  const handleCodeScan = useCallback(
    async (scanningResult: BarcodeScanningResult) => {
      const code = scanningResult.data;
      if (!code || isParsingRef.current) return;
      onSuccess(code);
    },
    [onSuccess],
  );

  const pickImage = useCallback(async () => {
    // No permissions request is necessary for launching the image library
    const result = await launchImageLibraryAsync({
      allowsEditing: true,
      allowsMultipleSelection: false,
      quality: 1,
    });
    // check is user cancel choose image
    if (!result.canceled) {
      try {
        const [assets] = result.assets;
        if (!assets || !assets.uri) return;
        const [codeRes] = await Camera.scanFromURLAsync(assets.uri);
        if (!codeRes) {
          onFailed();
        }

        if (codeRes.data) {
          onSuccess(codeRes.data);
        }
      } catch (error) {
        console.log('scan image error: ', error);
      }
    }
  }, [onSuccess, onFailed]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const requestCameraPermission = useCallback(async () => {
    const isSuccess = await requestPermission();
    if (!isSuccess) {
      setHasRejectCameraPermission(true);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const checkCameraPermission = useCallback(() => {
    if (!hasPermission) {
      requestCameraPermission();
    }
  }, [hasPermission]);

  const CameraComponent = useMemo(
    () => <CameraView facing="back" style={style} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleCodeScan} />,
    [style, handleCodeScan],
  );

  return {
    checkCameraPermission,
    hasRejectCameraPermission,
    hasCameraPermission: hasPermission?.granted,
    pickImage,
    Camera: CameraComponent,
  };
};

export default useQRCodeScan;

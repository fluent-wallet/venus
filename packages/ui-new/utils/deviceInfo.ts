import { Dimensions, Platform, StatusBar } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const Check3DStructureLight = () => {
  if (Platform.OS === 'android') {
    return false;
  }
  const model = DeviceInfo.getModel();
  let supports3DStructureLight = false;
  if (model.includes('iPhone')) {
    const modelNumber = Number.parseInt(model.replace(/[^\d]/g, ''), 10);
    if (modelNumber >= 10) {
      supports3DStructureLight = true;
    }
  }

  return supports3DStructureLight;
};

export const brand = DeviceInfo.getBrand();
export const isSamsungDevice = brand && brand.toLowerCase() === 'samsung';
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight! : 0;
export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;
export const supports3DStructureLight = Check3DStructureLight();
export const OS = Platform.OS;
export const isSmallDevice = screenHeight < 800;
export const isAdjustResize = Platform.OS === 'android' && Number(Platform.Version) < 30;

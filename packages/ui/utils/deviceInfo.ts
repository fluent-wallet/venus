
import { Platform, StatusBar } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight! : 0;

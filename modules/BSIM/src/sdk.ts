import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-bsim' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const NOT_SUPPORTED_IOS_ERROR = "The package 'react-native-bsim' is not supported on iOS.\n\n";

const NOT_LINK = new Proxy(
  {},
  {
    get() {
      throw new Error(LINKING_ERROR);
    },
  },
);

const NOT_SUPPORTED_IOS = new Proxy(
  {},
  {
    get() {
      throw new Error(NOT_SUPPORTED_IOS_ERROR);
    },
  },
);

export const BSIM = Platform.OS === 'ios' ? NOT_SUPPORTED_IOS : NativeModules.BSIM || NOT_LINK;

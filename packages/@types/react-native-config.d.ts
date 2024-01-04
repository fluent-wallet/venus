declare module 'react-native-config' {
  export interface NativeConfig {
    APP_ENV: 'dev' | 'qa' | 'prod';
  }

  export const Config: NativeConfig;
  export default Config;
}

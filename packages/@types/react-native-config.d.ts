declare module 'react-native-config' {
  export interface NativeConfig {
    APP_ENV: 'dev' | 'qa' | 'prod';
    PASSWORD_CRYPTO_KEY: string;
    APP_VERSION: string;
  }

  export const Config: NativeConfig;
  export default Config;
}

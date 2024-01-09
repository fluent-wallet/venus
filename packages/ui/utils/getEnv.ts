import Config from 'react-native-config';

console.log(Config)
export const getPasswordCryptoKey = () => Config.PASSWORD_CRYPTO_KEY;

export const isDev = Config.APP_ENV === 'dev';
export const isQA = Config.APP_ENV === 'qa';
export const isProd = Config.APP_ENV === 'prod';

export const getAppEnv = () => Config.APP_ENV;

export const devOnly = () => {
  return isDev;
};

export const qaOnly = () => {
  return isDev || isQA;
};

export const prodOnly = () => {
  return isProd;
};

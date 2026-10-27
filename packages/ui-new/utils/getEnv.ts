import Constants from 'expo-constants';
import { version } from '../../../package.json';

type AppEnvironment = 'dev' | 'qa' | 'prod';

interface AppConfigExtra {
  appEnv?: AppEnvironment;
  passwordCryptoKey?: string;
  displayVersion?: string;
  buildNumber?: string;
}

const getAppConfigExtra = (): AppConfigExtra | undefined => Constants.expoConfig?.extra;
const environment = getAppConfigExtra()?.appEnv;

export const getPasswordCryptoKey = (): string => {
  const key = getAppConfigExtra()?.passwordCryptoKey;
  if (typeof key !== 'string' || key.length === 0) throw new Error('PASSWORD_CRYPTO_KEY is missing.');
  return key;
};
export const isDev = environment === 'dev';
export const isQA = environment === 'qa';
export const isProd = environment === 'prod';

export const getAppEnv = () => environment;

export const getAPPVersion = (): string => {
  if (isDev) return 'dev';
  const extra = getAppConfigExtra();
  const displayVersion = extra?.displayVersion ?? version;
  return isQA && extra?.buildNumber ? `${displayVersion} (${extra.buildNumber})` : displayVersion;
};

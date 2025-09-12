import { getAppEnv, isDev, isQA } from './getEnv';
import { Platform } from 'react-native';

export const SUPPORT_BSIM_FEATURE = {
  describe: 'support bsim',
  allow: Platform.OS === 'android',
};

/** standing */
export const ACTIVITY_DEV_INFO_FEATURE = {
  describe: 'show activity dev info',
  allow: isQA || isDev,
};

/** standing */
export const ENABLE_SMALL_SIGNATURE_RECORDS_FEATURE = {
  describe: 'signature records with pagesize = 10 feature',
  allow: isDev || isQA,
};

export const DEVELOPER_FEATURE = {
  describe: 'developer feature',
  allow: isDev,
};

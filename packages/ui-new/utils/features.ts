import { getAppEnv, isDev, isQA } from './getEnv';
import { Platform } from 'react-native';

export const SUPPORT_BSIM_FEATURE = {
  describe: 'support bsim',
  allow: Platform.OS === 'android',
};


export const FULL_NETWORK_SWITCH_LIST_FEATURE = {
  describe: 'allow full network select list',
  allow: isDev,
};

export const ESPACE_NETWORK_SWITCH_FEATURE = {
  describe: 'only change the test network and main network for espace',
  allow: isQA || isDev,
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

import { getAppEnv, isDev, isQA } from './getEnv';

export const APP_VERSION_FLAG_FEATURE = {
  describe: 'add dev or qa flag to app version',
  allow: isQA || isDev,
  value: getAppEnv(),
};

export const FULL_NETWORK_SWITCH_LIST_FEATURE = {
  describe: 'allow full network select list',
  allow: isDev,
};

export const ESPACE_NETWORK_SWITCH_FEATURE = {
  describe: 'only change the test network and main network for espace',
  allow: isQA || isDev,
};

export const ACTIVITY_DB_STATUS_FEATURE = {
  describe: 'show activity db status after action',
  allow: isQA || isDev,
};

export const ENABLE_WALLET_CONNECT_FEATURE = {
  describe: 'wallet connect feature',
  allow: isDev || isQA,
};

export const DEVELOPER_FEATURE = {
  describe: 'developer feature',
  allow: isDev,
};

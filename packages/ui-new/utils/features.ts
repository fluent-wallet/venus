import { getAppEnv, isDev, isQA } from './getEnv';

export const APP_VERSION_FLAG_FEATURE = {
  describe: 'add dev or qa flag to app version',
  allow: isQA || isDev,
  value: getAppEnv(),
};

export const SWITCH_NETWORK_FEATURE_FULL_FEATURE = {
  describe: 'switch network list',
  allow: isDev,
};

export const SWITCH_TEST_NETWORK_FEATURE = {
  describe: 'switch test network list',
  allow: isQA || isDev,
};

export const ACTIVITY_DB_STATUS_FEATURE = {
  describe: 'show activity db status after action',
  allow: isQA || isDev,
};

export const ENABLE_WALLET_CONNECT_FEATURE = {
  describe: 'wallet connect feature',
  allow: isDev,
};

export const DEVELOPER_FEATURE = {
  describe: 'developer feature',
  allow: isDev,
};

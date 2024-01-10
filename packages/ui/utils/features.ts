import { getAppEnv, isDev, isQA } from './getEnv';

export const RESET_WALLET_DATA_FEATURE = {
  describe: 'Reset wallet data button',
  allow: isDev,
};

export const APP_VERSION_FLAG_FEATURE = {
  describe: 'add dev or qa flag to app version',
  allow: isQA || isDev,
  value: getAppEnv(),
};

export const SWITCH_NETWORK_FEATURE = {
  describe: 'switch network button',
  allow: isQA || isDev,
};

export const ADD_ACCOUNT_FEATURE = {
  describe: 'add account button',
  allow: isQA || isDev,
};

export const WELCOME_CREATE_WALLET_FEATURE = {
  describe: 'welcome create wallet button',
  allow: isQA || isDev,
};

export const WELCOME_IMPORT_WALLET_FEATURE = {
  describe: 'welcome import wallet button',
  allow: isQA || isDev,
};

export const ACTIVITY_DB_STATUS_FEATURE = {
  describe: 'show activity db status after action',
  allow: isQA || isDev,
};

export const configValueFormatters = {
  pendingPollingInterval: Number,
  executedPollingInterval: Number,
  confirmedPollingInterval: Number,
  pendingTimeBeforeSpeedUp: Number,
  pendingCountLimit: Number,
};
export type ConfigKey = keyof typeof configValueFormatters;
export type WalletConfig = { [key in ConfigKey]: ReturnType<(typeof configValueFormatters)[key]> };

export const configKeyList = Object.keys(configValueFormatters) as ConfigKey[];
export const defaultWalletConfigs: WalletConfig = {
  pendingPollingInterval: 3000,
  executedPollingInterval: 5000,
  confirmedPollingInterval: 30000,
  pendingTimeBeforeSpeedUp: 15000,
  pendingCountLimit: 5,
};

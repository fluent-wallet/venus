import { Networks, NetworkType } from '@core/utils/consts';
import type { INetwork } from '@service/core';
import { getAppEnv } from './getEnv';

type BuiltinNetworkKey = keyof typeof Networks;
type NetworkIdentity = Pick<INetwork, 'chainId' | 'networkType'>;

export interface NetworkTagConfig {
  color: string;
  label: string;
}

const NETWORK_TAG_COLORS: Record<NetworkType, string> = {
  [NetworkType.Conflux]: '#38A1DB',
  [NetworkType.Ethereum]: '#17B38A',
};

const ALL_BUILTIN_NETWORK_KEYS = Object.keys(Networks) as BuiltinNetworkKey[];

const PROD_VISIBLE_BUILTIN_NETWORK_KEYS = ['Conflux Mainnet', 'Conflux eSpace'] as const satisfies ReadonlyArray<BuiltinNetworkKey>;

const QA_VISIBLE_BUILTIN_NETWORK_KEYS = [
  'Conflux Mainnet',
  'Conflux eSpace',
  'Conflux Testnet',
  'eSpace Testnet',
] as const satisfies ReadonlyArray<BuiltinNetworkKey>;

const NETWORK_TAGS_BY_KEY: Record<BuiltinNetworkKey, NetworkTagConfig> = {
  'Conflux Mainnet': { color: NETWORK_TAG_COLORS[NetworkType.Conflux], label: 'Core' },
  'Conflux eSpace': { color: NETWORK_TAG_COLORS[NetworkType.Ethereum], label: 'eSpace' },
  'Conflux Testnet': { color: NETWORK_TAG_COLORS[NetworkType.Conflux], label: 'C Test' },
  'eSpace Testnet': { color: NETWORK_TAG_COLORS[NetworkType.Ethereum], label: 'E Test' },
  'Ethereum Mainnet': { color: NETWORK_TAG_COLORS[NetworkType.Ethereum], label: 'ETH' },
  'Ethereum Sepolia': { color: NETWORK_TAG_COLORS[NetworkType.Ethereum], label: 'Sep' },
};

const toChainKey = (network: NetworkIdentity) => `${String(network.networkType)}:${String(network.chainId).toLowerCase()}`;

const BUILTIN_NETWORK_KEYS_BY_CHAIN_KEY = new Map(
  ALL_BUILTIN_NETWORK_KEYS.map((key) => [
    toChainKey({
      chainId: Networks[key].chainId,
      networkType: Networks[key].networkType,
    }),
    key,
  ]),
);

export function getVisibleBuiltinNetworkKeys(appEnv = getAppEnv()): BuiltinNetworkKey[] {
  if (appEnv === 'prod') {
    return [...PROD_VISIBLE_BUILTIN_NETWORK_KEYS];
  }

  if (appEnv === 'qa') {
    return [...QA_VISIBLE_BUILTIN_NETWORK_KEYS];
  }

  return [...ALL_BUILTIN_NETWORK_KEYS];
}

export function getVisibleNetworks(networks: INetwork[], appEnv = getAppEnv()): INetwork[] {
  if (appEnv !== 'prod' && appEnv !== 'qa') {
    return networks;
  }

  const visibleKeys = getVisibleBuiltinNetworkKeys(appEnv);
  const networksByChainKey = new Map(networks.filter((network) => network.builtin !== false).map((network) => [toChainKey(network), network] as const));

  return visibleKeys
    .map((key) => networksByChainKey.get(toChainKey({ chainId: Networks[key].chainId, networkType: Networks[key].networkType })))
    .filter((network): network is INetwork => Boolean(network));
}

export function getNetworkTag(network: NetworkIdentity): NetworkTagConfig | null {
  const builtinKey = BUILTIN_NETWORK_KEYS_BY_CHAIN_KEY.get(toChainKey(network));
  if (!builtinKey) {
    return null;
  }

  return NETWORK_TAGS_BY_KEY[builtinKey] ?? null;
}

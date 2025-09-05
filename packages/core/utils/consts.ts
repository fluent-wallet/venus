export const MAINNET = 'mainnet';
export const TESTNET = 'testnet';
export const LOCALHOST = 'localhost';
export const CUSTOM = 'custom';
export const EXT_STORAGE = 'ext-storage';
export const NULL_HEX_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ADMINE_CONTROL_HEX_ADDRESS = '0x0888000000000000000000000000000000000000';
export const SPONSOR_WHITELIST_CONTROL_HEX_ADDRESS = '0x0888000000000000000000000000000000000001';
export const STAKING_HEX_ADDRESS = '0x0888000000000000000000000000000000000002';
export const MAX_EPOCH_NUMBER_OFFSET_IN_CORE = 100000n; // max offset is 10w in core
export const SUGGESTED_EPOCH_NUMBER_OFFSET_IN_CORE = 66666n; // use 66666 for suggest

export enum NetworkType {
  Conflux = 'Conflux',
  Ethereum = 'Ethereum',
}

export enum ChainType {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Custom = 'Custom',
}

export const INTERNAL_CONTRACTS_HEX_ADDRESS = [ADMINE_CONTROL_HEX_ADDRESS, SPONSOR_WHITELIST_CONTROL_HEX_ADDRESS, STAKING_HEX_ADDRESS];

export enum ADDRESS_TYPES {
  user = 'user',
  contract = 'contract',
  builtin = 'builtin',
  null = 'null',
}

// * network setting
const cfxIcon =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDIiIGhlaWdodD0iNDIiIHZpZXdCb3g9IjAgMCA0MiA0MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMSIgY3k9IjIxIiByPSIyMSIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0yNi41NzUgMjMuODA3bC01LjYwMSA1LjU4OC0yLjc4Ny0yLjc3OCA1LjYwMS01LjU4OC0yLjc5Ny0yLjc4OS04LjQzIDguNDA1IDguMzc3IDguMzUyIDguNDMtOC40MDUtMi43OTMtMi43ODV6IiBmaWxsPSIjMUExQTFBIi8+PHBhdGggZD0iTTMyLjIgMTguMTI4TDIxLjAzNyA2Ljk5OCA5LjggMTguMjAybC4wMzUgNS41NSAxMS4xNTMtMTEuMTE2IDExLjE5IDExLjE2Mi4wMjItNS42N3oiIGZpbGw9IiMzOEExREIiLz48L3N2Zz4=';
export const Networks = {
  'Conflux Mainnet': {
    name: 'Conflux Mainnet',
    endpoint: 'https://main.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Conflux,
    chainId: '0x405',
    netId: 1029,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://confluxscan.org',
    builtin: true,
    chainType: ChainType.Mainnet,
    gasBuffer: 1,
    hdPathIndex: 0,
    nativeAsset: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18,
      icon: cfxIcon,
    },
    scanOpenAPI: 'https://api.confluxscan.org',
  },
  'Conflux eSpace': {
    name: 'Conflux eSpace',
    endpoint: 'https://evm.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Ethereum,
    chainId: '0x406',
    netId: 1030,
    selected: true,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://evm.confluxscan.org',
    builtin: true,
    chainType: ChainType.Mainnet,
    gasBuffer: 1,
    hdPathIndex: 1,
    multicallContractAddress: '0x9f208d7226f05b4f43d0d36eb21d8545c3143685',
    nativeAsset: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18,
      icon: cfxIcon,
    },
    scanOpenAPI: 'https://evmapi.confluxscan.org',
  },
  'Conflux Testnet': {
    name: 'Conflux Testnet',
    endpoint: 'https://test.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Conflux,
    chainId: '0x1',
    netId: 1,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://testnet.confluxscan.org',
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1,
    hdPathIndex: 0,
    nativeAsset: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18,
      icon: cfxIcon,
    },
    scanOpenAPI: 'https://api-testnet.confluxscan.org',
  },
  'eSpace Testnet': {
    name: 'eSpace Testnet',
    endpoint: 'https://evmtestnet.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Ethereum,
    chainId: '0x47',
    netId: 71,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://evmtestnet.confluxscan.org',
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1,
    hdPathIndex: 1,
    multicallContractAddress: '0xd59149a01f910c3c448e41718134baeae55fa784',
    configContractAddress: '0xda7b3890a4196330216a749a410e14a316c87489',
    nativeAsset: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18,
      icon: cfxIcon,
    },
    scanOpenAPI: 'https://evmapi-testnet.confluxscan.org',
  },
  'Ethereum Mainnet': {
    name: 'Ethereum Mainnet',
    endpoint: 'https://mainnet.infura.io/v3/b6bf7d3508c941499b10025c0776eaf8',
    networkType: NetworkType.Ethereum,
    chainId: '0x1',
    netId: 1,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    scanUrl: 'https://etherscan.io',
    builtin: true,
    chainType: ChainType.Mainnet,
    gasBuffer: 1.5,
    hdPathIndex: 1,
    multicallContractAddress: '0x5ba1e12693dc8f9c48aad8770482f4739beed696',
    nativeAsset: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
    },
  },
  'Ethereum Sepolia': {
    name: 'Ethereum Sepolia',
    endpoint: 'https://sepolia.infura.io/v3/b6bf7d3508c941499b10025c0776eaf8',
    networkType: NetworkType.Ethereum,
    chainId: '0xaa36a7',
    netId: 11155111,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    scanUrl: 'https://sepolia.etherscan.io',
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1.5,
    hdPathIndex: 1,
    multicallContractAddress: '0x25Eef291876194AeFAd0D60Dff89e268b90754Bb',
    nativeAsset: {
      name: 'Ether',
      symbol: 'SepoliaETH',
      decimals: 18,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
    },
  },
  // ['eSpace 8889']: {
  //   name: 'eSpace 8889',
  //   endpoint: 'https://net8889eth.confluxrpc.com/',
  //   networkType: NetworkType.Ethereum,
  //   chainId: '0x22b9',
  //   netId: 8889,
  //   selected: false,
  //   icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
  //   scanUrl: 'https://net8889eth.confluxscan.net',
  //   builtin: false,
  //   chainType: ChainType.Testnet,
  //   gasBuffer: 1,
  //   hdPathIndex: 1,
  //   nativeAsset: {
  //     name: 'Conflux',
  //     symbol: 'CFX',
  //     decimals: 18,
  //     icon: cfxIcon,
  //   },
  // },
  // ['CoreSpace 8888']: {
  //   name: 'CoreSpace 8888',
  //   endpoint: 'https://net8888cfx.confluxrpc.com/',
  //   networkType: NetworkType.Conflux,
  //   chainId: '0x22b8',
  //   netId: 8888,
  //   selected: false,
  //   icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
  //   scanUrl: 'https://net8888cfx.confluxscan.net',
  //   builtin: false,
  //   chainType: ChainType.Testnet,
  //   gasBuffer: 1,
  //   hdPathIndex: 0,
  //   nativeAsset: {
  //     name: 'Conflux',
  //     symbol: 'CFX',
  //     decimals: 18,
  //     icon: cfxIcon,
  //   },
  // },
} as const;
export const NetworksWithChainIdKey = Object.fromEntries(Object.values(Networks).map((network) => [`${network.networkType}_${network.chainId}`, network]));

// * network setting

export const DEFAULT_CFX_HDPATH = "m/44'/503'/0'/0";
export const DEFAULT_ETH_HDPATH = "m/44'/60'/0'/0";

export const ETH_TX_TYPES = {
  LEGACY: '0x0',
  EIP2930: '0x1',
  EIP1559: '0x2',
};

export const TX_RESEND_LIMIT = Number.POSITIVE_INFINITY;

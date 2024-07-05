export const MAINNET = 'mainnet';
export const TESTNET = 'testnet';
export const LOCALHOST = 'localhost';
export const CUSTOM = 'custom';
export const EXT_STORAGE = 'ext-storage';
export const NULL_HEX_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ADMINE_CONTROL_HEX_ADDRESS = '0x0888000000000000000000000000000000000000';
export const SPONSOR_WHITELIST_CONTROL_HEX_ADDRESS = '0x0888000000000000000000000000000000000001';
export const STAKING_HEX_ADDRESS = '0x0888000000000000000000000000000000000002';
export const MAX_EPOCH_NUMBER_OFFSET = 66666n; // max offset is 10w, use 66666 for code

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
  ['Conflux Mainnet']: {
    name: 'Conflux Mainnet',
    endpoint: 'https://main.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Conflux,
    chainId: '0x405',
    netId: 1029,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://confluxscan.io',
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
  },
  ['Conflux eSpace']: {
    name: 'Conflux eSpace',
    endpoint: 'https://evm.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Ethereum,
    chainId: '0x406',
    netId: 1030,
    selected: true,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://evm.confluxscan.net',
    builtin: true,
    chainType: ChainType.Mainnet,
    gasBuffer: 1,
    hdPathIndex: 1,
    nativeAsset: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18,
      icon: cfxIcon,
    },
    scanOpenAPI: 'https://evmapi.confluxscan.io',
  },
  ['Ethereum Mainnet']: {
    name: 'Ethereum Mainnet',
    endpoint: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
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
    nativeAsset: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
    },
  },
  ['Conflux Testnet']: {
    name: 'Conflux Testnet',
    endpoint: 'https://test.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Conflux,
    chainId: '0x1',
    netId: 1,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://testnet.confluxscan.io',
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
  },
  ['eSpace Testnet']: {
    name: 'eSpace Testnet',
    endpoint: 'https://evmtestnet.confluxrpc.com/1BvViQet4km8KPALkc6Pa9',
    networkType: NetworkType.Ethereum,
    chainId: '0x47',
    netId: 71,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: 'https://evmtestnet.confluxscan.net',
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1,
    hdPathIndex: 1,
    nativeAsset: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18,
      icon: cfxIcon,
    },
    scanOpenAPI: 'https://evmapi-testnet.confluxscan.io',
  },
  ['Ethereum Sepolia']: {
    name: 'Ethereum Sepolia',
    endpoint: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
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
  //   scanUrl: 'https://net8889eth.confluxscan.net/',
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
  //   scanUrl: 'https://net8888cfx.confluxscan.net/',
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

// * network setting

export const DEFAULT_CFX_HDPATH = "m/44'/503'/0'/0";
export const DEFAULT_ETH_HDPATH = "m/44'/60'/0'/0";

export const ETH_TX_TYPES = {
  LEGACY: '0x0',
  EIP2930: '0x1',
  EIP1559: '0x2',
};

export const TX_RESEND_LIMIT = Number.POSITIVE_INFINITY;
export const CHECK_REPLACED_BEFORE_RESEND_COUNT = 5;

export const DETAULT_EXECUTED_INTERVAL = 3 * 1000;
export const DETAULT_CONFIRMED_INTERVAL = 5 * 1000;
export const DETAULT_FINALIZED_INTERVAL = 30 * 1000;

export const maxInt8 = 2n ** (8n - 1n) - 1n;
export const maxInt16 = 2n ** (16n - 1n) - 1n;
export const maxInt24 = 2n ** (24n - 1n) - 1n;
export const maxInt32 = 2n ** (32n - 1n) - 1n;
export const maxInt40 = 2n ** (40n - 1n) - 1n;
export const maxInt48 = 2n ** (48n - 1n) - 1n;
export const maxInt56 = 2n ** (56n - 1n) - 1n;
export const maxInt64 = 2n ** (64n - 1n) - 1n;
export const maxInt72 = 2n ** (72n - 1n) - 1n;
export const maxInt80 = 2n ** (80n - 1n) - 1n;
export const maxInt88 = 2n ** (88n - 1n) - 1n;
export const maxInt96 = 2n ** (96n - 1n) - 1n;
export const maxInt104 = 2n ** (104n - 1n) - 1n;
export const maxInt112 = 2n ** (112n - 1n) - 1n;
export const maxInt120 = 2n ** (120n - 1n) - 1n;
export const maxInt128 = 2n ** (128n - 1n) - 1n;
export const maxInt136 = 2n ** (136n - 1n) - 1n;
export const maxInt144 = 2n ** (144n - 1n) - 1n;
export const maxInt152 = 2n ** (152n - 1n) - 1n;
export const maxInt160 = 2n ** (160n - 1n) - 1n;
export const maxInt168 = 2n ** (168n - 1n) - 1n;
export const maxInt176 = 2n ** (176n - 1n) - 1n;
export const maxInt184 = 2n ** (184n - 1n) - 1n;
export const maxInt192 = 2n ** (192n - 1n) - 1n;
export const maxInt200 = 2n ** (200n - 1n) - 1n;
export const maxInt208 = 2n ** (208n - 1n) - 1n;
export const maxInt216 = 2n ** (216n - 1n) - 1n;
export const maxInt224 = 2n ** (224n - 1n) - 1n;
export const maxInt232 = 2n ** (232n - 1n) - 1n;
export const maxInt240 = 2n ** (240n - 1n) - 1n;
export const maxInt248 = 2n ** (248n - 1n) - 1n;
export const maxInt256 = 2n ** (256n - 1n) - 1n;

export const minInt8 = -(2n ** (8n - 1n));
export const minInt16 = -(2n ** (16n - 1n));
export const minInt24 = -(2n ** (24n - 1n));
export const minInt32 = -(2n ** (32n - 1n));
export const minInt40 = -(2n ** (40n - 1n));
export const minInt48 = -(2n ** (48n - 1n));
export const minInt56 = -(2n ** (56n - 1n));
export const minInt64 = -(2n ** (64n - 1n));
export const minInt72 = -(2n ** (72n - 1n));
export const minInt80 = -(2n ** (80n - 1n));
export const minInt88 = -(2n ** (88n - 1n));
export const minInt96 = -(2n ** (96n - 1n));
export const minInt104 = -(2n ** (104n - 1n));
export const minInt112 = -(2n ** (112n - 1n));
export const minInt120 = -(2n ** (120n - 1n));
export const minInt128 = -(2n ** (128n - 1n));
export const minInt136 = -(2n ** (136n - 1n));
export const minInt144 = -(2n ** (144n - 1n));
export const minInt152 = -(2n ** (152n - 1n));
export const minInt160 = -(2n ** (160n - 1n));
export const minInt168 = -(2n ** (168n - 1n));
export const minInt176 = -(2n ** (176n - 1n));
export const minInt184 = -(2n ** (184n - 1n));
export const minInt192 = -(2n ** (192n - 1n));
export const minInt200 = -(2n ** (200n - 1n));
export const minInt208 = -(2n ** (208n - 1n));
export const minInt216 = -(2n ** (216n - 1n));
export const minInt224 = -(2n ** (224n - 1n));
export const minInt232 = -(2n ** (232n - 1n));
export const minInt240 = -(2n ** (240n - 1n));
export const minInt248 = -(2n ** (248n - 1n));
export const minInt256 = -(2n ** (256n - 1n));

export const maxUint8 = 2n ** 8n - 1n;
export const maxUint16 = 2n ** 16n - 1n;
export const maxUint24 = 2n ** 24n - 1n;
export const maxUint32 = 2n ** 32n - 1n;
export const maxUint40 = 2n ** 40n - 1n;
export const maxUint48 = 2n ** 48n - 1n;
export const maxUint56 = 2n ** 56n - 1n;
export const maxUint64 = 2n ** 64n - 1n;
export const maxUint72 = 2n ** 72n - 1n;
export const maxUint80 = 2n ** 80n - 1n;
export const maxUint88 = 2n ** 88n - 1n;
export const maxUint96 = 2n ** 96n - 1n;
export const maxUint104 = 2n ** 104n - 1n;
export const maxUint112 = 2n ** 112n - 1n;
export const maxUint120 = 2n ** 120n - 1n;
export const maxUint128 = 2n ** 128n - 1n;
export const maxUint136 = 2n ** 136n - 1n;
export const maxUint144 = 2n ** 144n - 1n;
export const maxUint152 = 2n ** 152n - 1n;
export const maxUint160 = 2n ** 160n - 1n;
export const maxUint168 = 2n ** 168n - 1n;
export const maxUint176 = 2n ** 176n - 1n;
export const maxUint184 = 2n ** 184n - 1n;
export const maxUint192 = 2n ** 192n - 1n;
export const maxUint200 = 2n ** 200n - 1n;
export const maxUint208 = 2n ** 208n - 1n;
export const maxUint216 = 2n ** 216n - 1n;
export const maxUint224 = 2n ** 224n - 1n;
export const maxUint232 = 2n ** 232n - 1n;
export const maxUint240 = 2n ** 240n - 1n;
export const maxUint248 = 2n ** 248n - 1n;
export const maxUint256 = 2n ** 256n - 1n;

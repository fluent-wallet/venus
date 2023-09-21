import database from '../Database/index';

import {
  CFX_MAINNET_RPC_ENDPOINT,
  CFX_MAINNET_NAME,
  CFX_MAINNET_CHAINID,
  CFX_MAINNET_NETID,
  CFX_MAINNET_CURRENCY_SYMBOL,
  CFX_MAINNET_CURRENCY_NAME,
  CFX_MAINNET_EXPLORER_URL,
  CFX_ESPACE_MAINNET_RPC_ENDPOINT,
  CFX_ESPACE_MAINNET_NAME,
  CFX_ESPACE_MAINNET_CHAINID,
  CFX_ESPACE_MAINNET_NETID,
  CFX_ESPACE_MAINNET_CURRENCY_SYMBOL,
  CFX_ESPACE_MAINNET_CURRENCY_NAME,
  CFX_ESPACE_MAINNET_EXPLORER_URL,
  CFX_ESPACE_TESTNET_RPC_ENDPOINT,
  CFX_ESPACE_TESTNET_NAME,
  CFX_ESPACE_TESTNET_CHAINID,
  CFX_ESPACE_TESTNET_NETID,
  CFX_ESPACE_TESTNET_CURRENCY_SYMBOL,
  CFX_ESPACE_TESTNET_CURRENCY_NAME,
  CFX_ESPACE_TESTNET_EXPLORER_URL,
  CFX_TESTNET_RPC_ENDPOINT,
  CFX_TESTNET_NAME,
  CFX_TESTNET_CHAINID,
  CFX_TESTNET_NETID,
  CFX_TESTNET_CURRENCY_SYMBOL,
  CFX_TESTNET_CURRENCY_NAME,
  CFX_TESTNET_EXPLORER_URL,
  ETH_MAINNET_RPC_ENDPOINT,
  ETH_MAINNET_NAME,
  ETH_MAINNET_CHAINID,
  ETH_MAINNET_NETID,
  ETH_MAINNET_CURRENCY_SYMBOL,
  ETH_MAINNET_CURRENCY_NAME,
  ETH_MAINNET_EXPLORER_URL,
  ETH_GOERLI_RPC_ENDPOINT,
  ETH_GOERLI_NAME,
  ETH_GOERLI_CHAINID,
  ETH_GOERLI_NETID,
  ETH_GOERLI_CURRENCY_SYMBOL,
  ETH_GOERLI_CURRENCY_NAME,
  ETH_GOERLI_EXPLORER_URL,
  ETH_SEPOLIA_RPC_ENDPOINT,
  ETH_SEPOLIA_NAME,
  ETH_SEPOLIA_CHAINID,
  ETH_SEPOLIA_NETID,
  ETH_SEPOLIA_CURRENCY_SYMBOL,
  ETH_SEPOLIA_CURRENCY_NAME,
  ETH_SEPOLIA_EXPLORER_URL,
  DEFAULT_CFX_HDPATH,
  DEFAULT_ETH_HDPATH,
  DEFAULT_CURRENCY_DECIMALS,
} from '../Consts/network';

const HD_PATH_ARR = [
  { name: 'cfx-default', value: DEFAULT_CFX_HDPATH },
  { name: 'eth-default', value: DEFAULT_ETH_HDPATH },
];

const TOKEN_LIST_ARR = [
  {
    name: 'Fluent Default List',
    url: 'https://cdn.jsdelivr.net/gh/conflux-fans/token-list/cfx.fluent.json',
  },
  {
    name: 'Uniswap Default List',
    url: 'https://cdn.jsdelivr.net/gh/conflux-fans/token-list/eth.uniswap.json',
  },
  {
    name: 'Fluent Default Conflux Testnet List',
    url: 'https://cdn.jsdelivr.net/gh/conflux-fans/token-list/cfx.test.fluent.json',
  },
  {
    name: 'Fluent Default Conflux Espace List',
    url: 'https://cdn.jsdelivr.net/gh/conflux-fans/token-list/cfx-espace.fluent.json',
  },
];

const TICKER_ARR = [
  {
    name: CFX_MAINNET_CURRENCY_NAME,
    symbol: CFX_MAINNET_CURRENCY_SYMBOL,
    decimals: DEFAULT_CURRENCY_DECIMALS,
    iconUrls: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
  },
  {
    name: CFX_ESPACE_MAINNET_CURRENCY_NAME,
    symbol: CFX_ESPACE_MAINNET_CURRENCY_SYMBOL,
    decimals: DEFAULT_CURRENCY_DECIMALS,
    iconUrls: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
  },
  {
    name: ETH_MAINNET_CURRENCY_NAME,
    symbol: ETH_MAINNET_CURRENCY_SYMBOL,
    decimals: DEFAULT_CURRENCY_DECIMALS,
    iconUrls: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
  },
  {
    name: CFX_TESTNET_CURRENCY_NAME,
    symbol: CFX_TESTNET_CURRENCY_SYMBOL,
    decimals: DEFAULT_CURRENCY_DECIMALS,
    iconUrls: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
  },
  {
    name: CFX_ESPACE_TESTNET_CURRENCY_NAME,
    symbol: CFX_ESPACE_TESTNET_CURRENCY_SYMBOL,
    decimals: DEFAULT_CURRENCY_DECIMALS,
    iconUrls: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
  },
  {
    name: ETH_GOERLI_CURRENCY_NAME,
    symbol: ETH_GOERLI_CURRENCY_SYMBOL,
    decimals: DEFAULT_CURRENCY_DECIMALS,
    iconUrls: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
  },
  {
    name: ETH_SEPOLIA_CURRENCY_NAME,
    symbol: ETH_SEPOLIA_CURRENCY_SYMBOL,
    decimals: DEFAULT_CURRENCY_DECIMALS,
    iconUrls: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
  },
];

export const NETWORK_ARR = [
  {
    name: CFX_MAINNET_NAME,
    endpoint: CFX_MAINNET_RPC_ENDPOINT,
    networkType: 'cfx',
    chainId: CFX_MAINNET_CHAINID,
    netId: CFX_MAINNET_NETID,
    selected: true,
    cacheTime: 1000,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: CFX_MAINNET_EXPLORER_URL,
    hdPathIndex: 0,
    builtin: true,
    balanceChecker: 'cfx:achxne2gfh8snrstkxn0f32ua2cf19zwky2y66hj2d',
    tokenListIndex: 0,
    isMainnet: true,
  },
  {
    name: CFX_ESPACE_MAINNET_NAME,
    endpoint: CFX_ESPACE_MAINNET_RPC_ENDPOINT,
    networkType: 'eth',
    chainId: CFX_ESPACE_MAINNET_CHAINID,
    netId: CFX_ESPACE_MAINNET_NETID,
    cacheTime: 4000,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',

    scanUrl: CFX_ESPACE_MAINNET_EXPLORER_URL,
    hdPathIndex: 1,
    builtin: true,
    balanceChecker: '0x74191f6b288dff3db43b34d3637842c8146e2103',
    tokenListIndex: 3,
    isMainnet: true,
  },
  {
    name: ETH_MAINNET_NAME,
    endpoint: ETH_MAINNET_RPC_ENDPOINT,
    networkType: 'eth',
    chainId: ETH_MAINNET_CHAINID,
    netId: ETH_MAINNET_NETID,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    cacheTime: 15000,

    scanUrl: ETH_MAINNET_EXPLORER_URL,
    hdPathIndex: 1,
    builtin: true,
    balanceChecker: '0xb1f8e55c7f64d203c1400b9d8555d050f94adf39',
    tokenListIndex: 1,
    isMainnet: true,
    gasBuffer: 1.5,
  },
  {
    name: CFX_TESTNET_NAME,
    endpoint: CFX_TESTNET_RPC_ENDPOINT,
    networkType: 'cfx',
    chainId: CFX_TESTNET_CHAINID,
    netId: CFX_TESTNET_NETID,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    cacheTime: 1000,

    hdPathIndex: 0,
    scanUrl: CFX_TESTNET_EXPLORER_URL,
    balanceChecker: 'cfxtest:achxne2gfh8snrstkxn0f32ua2cf19zwkyw9tpbc6k',
    builtin: true,
    tokenListIndex: 2,
    isTestnet: true,
  },
  {
    name: CFX_ESPACE_TESTNET_NAME,
    endpoint: CFX_ESPACE_TESTNET_RPC_ENDPOINT,
    networkType: 'eth',
    chainId: CFX_ESPACE_TESTNET_CHAINID,
    netId: CFX_ESPACE_TESTNET_NETID,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    cacheTime: 4000,

    hdPathIndex: 1,
    scanUrl: CFX_ESPACE_TESTNET_EXPLORER_URL,
    balanceChecker: '0x74191f6b288dff3db43b34d3637842c8146e2103',
    builtin: true,
    isTestnet: true,
  },
  {
    name: ETH_GOERLI_NAME,
    endpoint: ETH_GOERLI_RPC_ENDPOINT,
    networkType: 'eth',
    chainId: ETH_GOERLI_CHAINID,
    netId: ETH_GOERLI_NETID,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    cacheTime: 15000,

    scanUrl: ETH_GOERLI_EXPLORER_URL,
    hdPathIndex: 1,
    builtin: true,
    isTestnet: true,
    balanceChecker: '0x9788c4e93f9002a7ad8e72633b11e8d1ecd51f9b',
    gasBuffer: 1.5,
  },
  {
    name: ETH_SEPOLIA_NAME,
    endpoint: ETH_SEPOLIA_RPC_ENDPOINT,
    networkType: 'eth',
    chainId: ETH_SEPOLIA_CHAINID,
    netId: ETH_SEPOLIA_NETID,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    cacheTime: 15000,

    scanUrl: ETH_SEPOLIA_EXPLORER_URL,
    hdPathIndex: 1,
    builtin: true,
    isTestnet: true,
    // TODO(SEPOLIA) There is currently no balance call address for Sepolia
    balanceChecker: '',
    gasBuffer: 1.5,
  },
];

const createTableInstance = (paramArr, table) =>
  paramArr.map((p) =>
    table.prepareCreate((r) => {
      for (let [key, value] of Object.entries(p)) {
        r[key] = value;
      }
    })
  );

const initDatabase = async () => {
  try {
    const isDatabaseInit = await database.localStorage.get('is_database_init');
    if (isDatabaseInit) {
      return;
    }

    await database.write(async () => {
      const hdPathTable = database.get('hd_path');
      const tokenListTable = database.get('token_list');
      const networkTable = database.get('network');
      const tickerTable = database.get('ticker');

      const tokenListTableInstances = createTableInstance(TOKEN_LIST_ARR, tokenListTable);

      const hdTableInstances = createTableInstance(HD_PATH_ARR, hdPathTable);

      const tickerTableInstances = createTableInstance(TICKER_ARR, tickerTable);

      const networkTableInstances = NETWORK_ARR.map((netParams, index) => {
        let { hdPathIndex, tokenListIndex, ...restParams } = netParams;
        return networkTable.prepareCreate((record) => {
          if (hdPathIndex !== undefined) {
            record.hdPath.set(hdTableInstances[hdPathIndex]);
          }
          if (tokenListIndex !== undefined) {
            record.tokenList.set(tokenListTableInstances[tokenListIndex]);
          }
          record.ticker.set(tickerTableInstances[index]);
          for (let [key, value] of Object.entries(restParams)) {
            record[key] = value;
          }
        });
      });
      await database.batch(...tokenListTableInstances, ...hdTableInstances, ...tickerTableInstances, ...networkTableInstances);
      await database.localStorage.set('is_database_init', 'yes');
    });
  } catch (error) {
    console.error('error', error);
  }
};

export default initDatabase;

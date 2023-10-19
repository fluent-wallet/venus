import database from '../';
import TableName from '../TableName';
import { createHdPath } from '../models/HdPath';
import { createTokenList } from '../models/TokenList';
import { createTicker } from '../models/Ticker';
import { createNetwork, NetworkParams } from '../models/Network/service';

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
} from '../../Consts/network';

const HD_PATH_ARR = [
  { name: 'cfx-default', value: DEFAULT_CFX_HDPATH },
  { name: 'eth-default', value: DEFAULT_ETH_HDPATH },
] as const;

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

export const NETWORK_ARR: Array<NetworkParams & { tokenListIndex?: number; hdPathIndex?: number }> = [
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
    builtin: true,
    balanceChecker: 'cfx:achxne2gfh8snrstkxn0f32ua2cf19zwky2y66hj2d',
    chainType: 'mainnet',
    gasBuffer: 1,
    tokenListIndex: 0,
    hdPathIndex: 0,
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
    builtin: true,
    balanceChecker: '0x74191f6b288dff3db43b34d3637842c8146e2103',
    chainType: 'mainnet',
    gasBuffer: 1,
    hdPathIndex: 1,
    tokenListIndex: 3,
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
    builtin: true,
    balanceChecker: '0xb1f8e55c7f64d203c1400b9d8555d050f94adf39',
    chainType: 'mainnet',
    gasBuffer: 1.5,
    hdPathIndex: 1,
    tokenListIndex: 1,
  },
  {
    name: CFX_TESTNET_NAME,
    endpoint: CFX_TESTNET_RPC_ENDPOINT,
    networkType: 'cfx',
    chainId: CFX_TESTNET_CHAINID,
    netId: CFX_TESTNET_NETID,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    cacheTime: 1000,
    scanUrl: CFX_TESTNET_EXPLORER_URL,
    balanceChecker: 'cfxtest:achxne2gfh8snrstkxn0f32ua2cf19zwkyw9tpbc6k',
    builtin: true,
    chainType: 'testnet',
    gasBuffer: 1,
    hdPathIndex: 0,
    tokenListIndex: 2,
  },
  {
    name: CFX_ESPACE_TESTNET_NAME,
    endpoint: CFX_ESPACE_TESTNET_RPC_ENDPOINT,
    networkType: 'eth',
    chainId: CFX_ESPACE_TESTNET_CHAINID,
    netId: CFX_ESPACE_TESTNET_NETID,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    cacheTime: 4000,
    scanUrl: CFX_ESPACE_TESTNET_EXPLORER_URL,
    balanceChecker: '0x74191f6b288dff3db43b34d3637842c8146e2103',
    builtin: true,
    chainType: 'testnet',
    gasBuffer: 1,
    hdPathIndex: 1,
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
    builtin: true,
    balanceChecker: '0x9788c4e93f9002a7ad8e72633b11e8d1ecd51f9b',
    chainType: 'testnet',
    gasBuffer: 1.5,
    hdPathIndex: 1,
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
    builtin: true,
    // TODO(SEPOLIA) There is currently no balance call address for Sepolia
    balanceChecker: '',
    chainType: 'testnet',
    gasBuffer: 1.5,
    hdPathIndex: 1,
  },
];

const initDatabase = async () => {
  try {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  } catch (error) {
    console.error('Reset database error', error);
  }
  try {
    // Should skip if the DB has already been initialized.
    if ((await database.get(TableName.HdPath).query().fetchCount()) !== 0) {
      return;
    }

    await database.write(async () => {
      const hdPaths = HD_PATH_ARR.map((params) => createHdPath(params, true));
      const tokenLists = TOKEN_LIST_ARR.map((params) => createTokenList(params, true));
      const tickers = TICKER_ARR.map((params) => createTicker(params, true));
      const networks = NETWORK_ARR.map(({ hdPathIndex, tokenListIndex, ...params }) => {
        return createNetwork(
          {
            ...params,
            ...(typeof hdPathIndex === 'number' ? { hdPath: hdPaths[hdPathIndex] } : null),
            ...(typeof tokenListIndex === 'number' ? { tokenList: tokenLists[tokenListIndex] } : null),
          },
          true
        );
      });
      await database.batch(...hdPaths, ...tokenLists, ...tickers, ...networks.flat());
    });
  } catch (error) {
    console.error('Init Database error', error);
  }
};

initDatabase();

import { injectable, inject } from 'inversify';
import database, { dbRefresh$ } from '../../database';
import TableName from '../../database/TableName';
import { createHdPath } from '../../database/models/HdPath/query';
import { ChainType, NetworkType } from '../../database/models/Network';
import { NetworkParams } from '../../database/models/Network/query';
import { NetworkMethod } from './networkMethod';
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
} from '../../consts/network';


const HD_PATH_ARR = [
  { name: 'cfx-default', value: DEFAULT_CFX_HDPATH },
  { name: 'eth-default', value: DEFAULT_ETH_HDPATH },
] as const;

export const NETWORK_ARR: Array<NetworkParams & { hdPathIndex: number; nativeAsset: { name: string; symbol: string; decimals: number; icon: string } }> = [
  {
    name: CFX_MAINNET_NAME,
    endpoint: CFX_MAINNET_RPC_ENDPOINT,
    networkType: NetworkType.Conflux,
    chainId: CFX_MAINNET_CHAINID,
    netId: CFX_MAINNET_NETID,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: CFX_MAINNET_EXPLORER_URL,
    builtin: true,
    chainType: ChainType.Mainnet,
    gasBuffer: 1,
    hdPathIndex: 0,
    nativeAsset: {
      name: CFX_MAINNET_CURRENCY_NAME,
      symbol: CFX_MAINNET_CURRENCY_SYMBOL,
      decimals: DEFAULT_CURRENCY_DECIMALS,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
    },
  },
  {
    name: CFX_ESPACE_MAINNET_NAME,
    endpoint: CFX_ESPACE_MAINNET_RPC_ENDPOINT,
    networkType: NetworkType.Ethereum,
    chainId: CFX_ESPACE_MAINNET_CHAINID,
    netId: CFX_ESPACE_MAINNET_NETID,
    selected: true,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: CFX_ESPACE_MAINNET_EXPLORER_URL,
    builtin: true,
    chainType: ChainType.Mainnet,
    gasBuffer: 1,
    hdPathIndex: 1,
    nativeAsset: {
      name: CFX_ESPACE_MAINNET_CURRENCY_NAME,
      symbol: CFX_ESPACE_MAINNET_CURRENCY_SYMBOL,
      decimals: DEFAULT_CURRENCY_DECIMALS,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
    },
  },
  {
    name: ETH_MAINNET_NAME,
    endpoint: ETH_MAINNET_RPC_ENDPOINT,
    networkType: NetworkType.Ethereum,
    chainId: ETH_MAINNET_CHAINID,
    netId: ETH_MAINNET_NETID,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    scanUrl: ETH_MAINNET_EXPLORER_URL,
    builtin: true,
    chainType: ChainType.Mainnet,
    gasBuffer: 1.5,
    hdPathIndex: 1,
    nativeAsset: {
      name: ETH_MAINNET_CURRENCY_NAME,
      symbol: ETH_MAINNET_CURRENCY_SYMBOL,
      decimals: DEFAULT_CURRENCY_DECIMALS,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
    },
  },
  {
    name: CFX_TESTNET_NAME,
    endpoint: CFX_TESTNET_RPC_ENDPOINT,
    networkType: NetworkType.Conflux,
    chainId: CFX_TESTNET_CHAINID,
    netId: CFX_TESTNET_NETID,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: CFX_TESTNET_EXPLORER_URL,
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1,
    hdPathIndex: 0,
    nativeAsset: {
      name: CFX_TESTNET_CURRENCY_NAME,
      symbol: CFX_TESTNET_CURRENCY_SYMBOL,
      decimals: DEFAULT_CURRENCY_DECIMALS,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
    },
  },
  {
    name: CFX_ESPACE_TESTNET_NAME,
    endpoint: CFX_ESPACE_TESTNET_RPC_ENDPOINT,
    networkType: NetworkType.Ethereum,
    chainId: CFX_ESPACE_TESTNET_CHAINID,
    netId: CFX_ESPACE_TESTNET_NETID,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Conflux.svg',
    scanUrl: CFX_ESPACE_TESTNET_EXPLORER_URL,
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1,
    hdPathIndex: 1,
    nativeAsset: {
      name: CFX_ESPACE_TESTNET_CURRENCY_NAME,
      symbol: CFX_ESPACE_TESTNET_CURRENCY_SYMBOL,
      decimals: DEFAULT_CURRENCY_DECIMALS,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/cfx.svg',
    },
  },
  {
    name: ETH_GOERLI_NAME,
    endpoint: ETH_GOERLI_RPC_ENDPOINT,
    networkType: NetworkType.Ethereum,
    chainId: ETH_GOERLI_CHAINID,
    netId: ETH_GOERLI_NETID,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    scanUrl: ETH_GOERLI_EXPLORER_URL,
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1.5,
    hdPathIndex: 1,
    nativeAsset: {
      name: ETH_GOERLI_CURRENCY_NAME,
      symbol: ETH_GOERLI_CURRENCY_SYMBOL,
      decimals: DEFAULT_CURRENCY_DECIMALS,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
    },
  },
  {
    name: ETH_SEPOLIA_NAME,
    endpoint: ETH_SEPOLIA_RPC_ENDPOINT,
    networkType: NetworkType.Ethereum,
    chainId: ETH_SEPOLIA_CHAINID,
    netId: ETH_SEPOLIA_NETID,
    selected: false,
    icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/Ethereum.svg',
    scanUrl: ETH_SEPOLIA_EXPLORER_URL,
    builtin: true,
    chainType: ChainType.Testnet,
    gasBuffer: 1.5,
    hdPathIndex: 1,
    nativeAsset: {
      name: ETH_SEPOLIA_CURRENCY_NAME,
      symbol: ETH_SEPOLIA_CURRENCY_SYMBOL,
      decimals: DEFAULT_CURRENCY_DECIMALS,
      icon: 'https://cdn.jsdelivr.net/gh/Conflux-Chain/helios@dev/packages/built-in-network-icons/eth.svg',
    },
  },
];

async function clearTables(tableNames: Array<TableName>) {
  const recordFetchingPromises = tableNames.map(async (tableName) => {
    const collection = database.get(tableName);
    const allRecords = await collection.query().fetch();
    return allRecords.map((record) => record.prepareDestroyPermanently());
  });

  const allDeletions = await Promise.all(recordFetchingPromises);
  const deletions = allDeletions.flat();

  await database.write(async () => {
    await database.batch(...deletions);
  });
}

@injectable()
export class DatabaseMethod {
  @inject(NetworkMethod) private NetworkMethod!: NetworkMethod;

  async initDatabaseDefault() {
    try {
      // Should skip if the DB has already been initialized.
      if ((await database.get(TableName.HdPath).query().fetchCount()) !== 0) {
        return true;
      }
      
      await database.write(async () => {
        const hdPaths = HD_PATH_ARR.map((params) => createHdPath(params, true));
        const networks = await Promise.all(
          NETWORK_ARR.map(async ({ hdPathIndex, ...params }) => {
            return await this.NetworkMethod.createNetwork(
              {
                ...params,
                ...(typeof hdPathIndex === 'number' ? { hdPath: hdPaths[hdPathIndex] } : null),
              },
              true
            );
          })
        );
        await database.batch(...hdPaths, ...(Array.isArray(networks) ? networks.flat() : []));
      });

      return true;
    } catch (error) {
      console.error('Init Database error', error);
      return false;
    }
  }

  async clearAccountData() {
    try {
      await clearTables([
        TableName.Address,
        TableName.Account,
        TableName.AccountGroup,
        TableName.Vault,
        TableName.Tx,
        TableName.TxExtra,
        TableName.TxPayload,
        TableName.App,
        TableName.Site,
        TableName.Permission,
        TableName.Request,
      ]);
      dbRefresh$.next(null);
    } catch (error) {
      console.error('Clear account data error', error);
      throw error;
    }
  }

  initDatabase: () => void = null!;
  async resetDatabase() {
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
      if (this.initDatabase) {
        await this.initDatabase();
      } else {
        await this.initDatabaseDefault();
      }
      dbRefresh$.next(null);
    } catch (error) {
      console.error('Reset database error', error);
    }
  }
}

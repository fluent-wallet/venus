import { fetchChain, fetchChainBatch, fetchChainMulticall } from '@cfx-kit/dapp-utils/dist/fetch';
import { createERC20Contract } from '@cfx-kit/dapp-utils/dist/contract';
import { convertCfxToHex } from '../../../../utils/address';
import { type Address } from './../../../../database/models/Address';
import { NetworkType, networkRpcPrefixMap, networkRpcSuffixMap } from '../../../../database/models/Network';
import { AssetType } from '../../../../database/models/Asset';

export const fetchNativeAssetBalance = ({ networkType, endpoint, accountAddress }: { networkType: NetworkType; endpoint: string; accountAddress: Address }) => {
  switch (networkType) {
    case NetworkType.Conflux:
    case NetworkType.Ethereum:
    default: {
      const rpcPrefix = networkRpcPrefixMap[networkType];
      const rpcSuffix = networkRpcSuffixMap[networkType];

      return fetchChain<string>({
        url: endpoint,
        method: `${rpcPrefix}_getBalance`,
        params: [networkType === NetworkType.Conflux ? accountAddress.base32 : accountAddress.hex, rpcSuffix],
      });
    }
  }
};

export const fetchConfluxNativeAssetBalance = ({ endpoint, accountAddress }: { endpoint: string; accountAddress: Address }) =>
  fetchNativeAssetBalance({ networkType: NetworkType.Conflux, endpoint, accountAddress });

export const fetchEthereumNativeAssetBalance = ({ endpoint, accountAddress }: { endpoint: string; accountAddress: Address }) =>
  fetchNativeAssetBalance({ networkType: NetworkType.Ethereum, endpoint, accountAddress });

export function fetchContractAssetBalance({
  networkType,
  endpoint,
  accountAddress,
  contractAddress,
}: {
  networkType: NetworkType;
  endpoint: string;
  accountAddress: Address;
  contractAddress: string;
}) {
  switch (networkType) {
    case NetworkType.Conflux:
    case NetworkType.Ethereum:
    default: {
      const rpcPrefix = networkRpcPrefixMap[networkType];
      const rpcSuffix = networkRpcSuffixMap[networkType];
      return fetchChain<string>({
        url: endpoint,
        method: `${rpcPrefix}_call`,
        params: [
          {
            to: contractAddress,
            data: `0x70a08231000000000000000000000000${accountAddress.hex.slice(2)}`,
          },
          rpcSuffix,
        ],
      });
    }
  }
}

export const fetchConfluxERC20AssetBalance = ({
  endpoint,
  accountAddress,
  contractAddress,
}: {
  endpoint: string;
  accountAddress: Address;
  contractAddress: string;
}) => fetchContractAssetBalance({ networkType: NetworkType.Conflux, endpoint, accountAddress, contractAddress });

export const fetchEthereumERC20AssetBalance = ({
  endpoint,
  accountAddress,
  contractAddress,
}: {
  endpoint: string;
  accountAddress: Address;
  contractAddress: string;
}) => fetchContractAssetBalance({ networkType: NetworkType.Ethereum, endpoint, accountAddress, contractAddress });

export const fetchAssetsBalance = async ({
  networkType,
  endpoint,
  accountAddress,
  assets,
}: {
  networkType: NetworkType;
  endpoint: string;
  accountAddress: Address;
  assets: Array<{
    contractAddress?: string | null;
    assetType?: Omit<AssetType, AssetType.ERC1155 | AssetType.ERC721>;
  }>;
}) => {
  return Promise.all(
    assets.map(({ contractAddress, assetType }) =>
      assetType === AssetType.ERC20 && contractAddress
        ? fetchContractAssetBalance({ networkType, endpoint, accountAddress, contractAddress })
        : fetchNativeAssetBalance({ networkType, endpoint, accountAddress }),
    ),
  );
};

export const fetchAssetsBalanceBatch = ({
  endpoint,
  accountAddress,
  assets,
  networkType,
  key,
}: {
  endpoint: string;
  accountAddress: Address;
  assets: Array<{ assetType?: Omit<AssetType, AssetType.ERC1155 | AssetType.ERC721>; contractAddress?: string | null }>;
  networkType: NetworkType;
  key?: string;
}) => {
  if (assets.some(({ assetType, contractAddress }) => !assetType && !contractAddress)) {
    throw new Error('assetType or contractAsset is required');
  }
  const rpcPrefix = networkRpcPrefixMap[networkType];
  return fetchChainBatch<Array<string>>({
    key,
    url: endpoint,
    rpcs: assets.map(({ assetType, contractAddress }) => ({
      method: assetType === AssetType.Native ? `${rpcPrefix}_getBalance` : `${rpcPrefix}_call`,
      params: [
        assetType === AssetType.Native
          ? networkType === NetworkType.Conflux
            ? accountAddress.base32
            : accountAddress.hex
          : {
              to: contractAddress,
              data: `0x70a08231000000000000000000000000${accountAddress.hex.slice(2)}`,
            },
        networkRpcSuffixMap[networkType],
      ],
    })),
  });
};

export const fetchAssetsBalanceMulticall = ({
  endpoint,
  accountAddress,
  assets,
  networkType,
  multicallContractAddress,
  key,
}: {
  endpoint: string;
  accountAddress: Address;
  assets: Array<{ assetType?: Omit<AssetType, AssetType.ERC1155 | AssetType.ERC721>; contractAddress?: string | null }>;
  networkType: NetworkType;
  multicallContractAddress: string;
  key?: string;
}) => {
  if (assets.some(({ assetType, contractAddress }) => !assetType && !contractAddress)) {
    throw new Error('assetType or contractAsset is required');
  }
  const rpcPrefix = networkRpcPrefixMap[networkType];

  const assetsWithIndex = assets.map((asset, index) => ({ ...asset, index }));
  const nativeAssetIndex = assets.findIndex(({ assetType }) => assetType === AssetType.Native);
  const contractAssets = nativeAssetIndex === -1 ? assetsWithIndex : assetsWithIndex.filter((asset) => asset.assetType !== AssetType.Native);

  let promiseNative: Promise<string> | undefined;
  if (nativeAssetIndex !== -1) {
    promiseNative = fetchNativeAssetBalance({ networkType, endpoint, accountAddress });
  }

  let promiseContracts: Promise<Array<string>> | undefined;
  if (contractAssets.length !== 0) {
    promiseContracts = fetchChainMulticall({
      key,
      url: endpoint,
      method: `${rpcPrefix}_call`,
      multicallContractAddress,
      data: contractAssets.map(({ contractAddress }) => ({
        contractAddress: contractAddress!,
        encodedData: `0x70a08231000000000000000000000000${accountAddress.hex.slice(2)}`,
      })),
    });
  }

  return Promise.all([promiseNative, promiseContracts]).then(([nativeAssetBalance, contractAssetsBalance]) => {
    const result: Array<string> = Array.from({ length: assets.length });
    if (nativeAssetBalance) {
      assetsWithIndex.forEach(({ assetType, index }) => {
        if (assetType === AssetType.Native) {
          result[index] = nativeAssetBalance;
        }
      });
    }

    if (contractAssetsBalance) {
      contractAssets?.forEach(({ index }) => {
        result[index] = contractAssetsBalance[index];
      });
    }

    return result;
  });
};

export const fetchERC20ContractAssetInfo = async ({
  networkType,
  endpoint,
  contractAddress,
}: {
  networkType: NetworkType;
  endpoint: string;
  contractAddress: string;
}) => {
  const rpcPrefix = networkRpcPrefixMap[networkType];
  const rpcSuffix = networkRpcSuffixMap[networkType];

  const contract = createERC20Contract(contractAddress);
  const promiseRes = await Promise.all([
    fetchChain<string>({
      url: endpoint,
      method: `${rpcPrefix}_call`,
      params: [{ to: contractAddress, data: contract.encodeFunctionData('name', []) }, rpcSuffix],
    }),
    fetchChain<string>({
      url: endpoint,
      method: `${rpcPrefix}_call`,
      params: [{ to: contractAddress, data: contract.encodeFunctionData('symbol', []) }, rpcSuffix],
    }),
    fetchChain<string>({
      url: endpoint,
      method: `${rpcPrefix}_call`,
      params: [{ to: contractAddress, data: contract.encodeFunctionData('decimals', []) }, rpcSuffix],
    }),
  ]);

  return {
    name: contract.decodeFunctionResult('name', promiseRes[0])?.[0],
    symbol: contract.decodeFunctionResult('symbol', promiseRes[1])?.[0],
    decimals: contract.decodeFunctionResult('decimals', promiseRes[2])?.[0],
  };
};

export const fetchERC20AssetInfoBatch = async ({
  networkType,
  endpoint,
  contractAddress,
}: {
  networkType: NetworkType;
  endpoint: string;
  contractAddress: string;
}) => {
  const rpcPrefix = networkRpcPrefixMap[networkType];
  const rpcSuffix = networkRpcSuffixMap[networkType];

  const contract = createERC20Contract(contractAddress);

  const promiseRes = await fetchChainBatch<[string, string, string]>({
    url: endpoint,
    rpcs: [
      {
        method: `${rpcPrefix}_call`,
        params: [{ to: contractAddress, data: contract.encodeFunctionData('name', []) }, rpcSuffix],
      },
      {
        method: `${rpcPrefix}_call`,
        params: [{ to: contractAddress, data: contract.encodeFunctionData('symbol', []) }, rpcSuffix],
      },
      {
        method: `${rpcPrefix}_call`,
        params: [{ to: contractAddress, data: contract.encodeFunctionData('decimals', []) }, rpcSuffix],
      },
    ],
  });

  return {
    name: contract.decodeFunctionResult('name', promiseRes[0])?.[0],
    symbol: contract.decodeFunctionResult('symbol', promiseRes[1])?.[0],
    decimals: contract.decodeFunctionResult('decimals', promiseRes[2])?.[0],
  };
};

export const fetchERC20AssetInfoMulticall = async ({
  networkType,
  endpoint,
  contractAddress,
  multicallContractAddress,
}: {
  networkType: NetworkType;
  endpoint: string;
  contractAddress: string;
  multicallContractAddress: string;
}) => {
  const rpcPrefix = networkRpcPrefixMap[networkType];

  const contract = createERC20Contract(contractAddress);

  return fetchChainMulticall({
    url: endpoint,
    multicallContractAddress,
    method: `${rpcPrefix}_call`,
    data: {
      name: {
        contractAddress,
        encodedData: contract.encodeFunctionData('name', []),
        decodeFunc: (res) => contract.decodeFunctionResult('name', res),
      },
      symbol: {
        contractAddress,
        encodedData: contract.encodeFunctionData('symbol', []),
        decodeFunc: (res) => contract.decodeFunctionResult('symbol', res),
      },
      decimal: {
        contractAddress,
        encodedData: contract.encodeFunctionData('decimals', []),
        decodeFunc: (res) => contract.decodeFunctionResult('decimals', res),
      },
    },
  });
};

export const fetchERC20ContractAssetsInfo = async ({ networkType, endpoint, assets }: { networkType: NetworkType; endpoint: string; assets: Array<string> }) =>
  Promise.all(assets.map((contractAddress) => fetchERC20ContractAssetInfo({ networkType, endpoint, contractAddress })));

export const fetchERC20AssetsInfoBatch = async ({ networkType, endpoint, assets }: { networkType: NetworkType; endpoint: string; assets: Array<string> }) => {
  const rpcPrefix = networkRpcPrefixMap[networkType];
  const rpcSuffix = networkRpcSuffixMap[networkType];

  return fetchChainBatch<Array<string>>({
    url: endpoint,
    rpcs: assets
      .map((contractAddress) => {
        const contract = createERC20Contract(contractAddress);
        return [
          {
            method: `${rpcPrefix}_call`,
            params: [{ to: contractAddress, data: contract.encodeFunctionData('name', []) }, rpcSuffix],
          },
          {
            method: `${rpcPrefix}_call`,
            params: [{ to: contractAddress, data: contract.encodeFunctionData('symbol', []) }, rpcSuffix],
          },
          {
            method: `${rpcPrefix}_call`,
            params: [{ to: contractAddress, data: contract.encodeFunctionData('decimals', []) }, rpcSuffix],
          },
        ];
      })
      .flat(),
  }).then((res) => {
    const result: Array<{ name: string; symbol: string; decimals: number }> = [];
    for (let i = 0; i < res.length; i += 3) {
      result.push({
        name: createERC20Contract(assets[i / 3]).decodeFunctionResult('name', res[i])?.[0],
        symbol: createERC20Contract(assets[i / 3]).decodeFunctionResult('symbol', res[i + 1])?.[0],
        decimals: createERC20Contract(assets[i / 3]).decodeFunctionResult('decimals', res[i + 2])?.[0],
      });
    }
    return result;
  });
};

export const fetchERC20AssetsInfoMulticall = async ({
  networkType,
  endpoint,
  assets,
  multicallContractAddress,
}: {
  networkType: NetworkType;
  endpoint: string;
  assets: Array<string>;
  multicallContractAddress: string;
}) => {
  const rpcPrefix = networkRpcPrefixMap[networkType];

  return fetchChainMulticall({
    url: endpoint,
    multicallContractAddress,
    method: `${rpcPrefix}_call`,
    data: assets
      .map((contractAddress) => {
        const contract = createERC20Contract(contractAddress);
        return [
          {
            contractAddress,
            encodedData: contract.encodeFunctionData('name', []),
            decodeFunc: (res: string) => contract.decodeFunctionResult('name', res),
          },
          {
            contractAddress,
            encodedData: contract.encodeFunctionData('symbol', []),
            decodeFunc: (res: string) => contract.decodeFunctionResult('symbol', res),
          },
          {
            contractAddress,
            encodedData: contract.encodeFunctionData('decimals', []),
            decodeFunc: (res: string) => contract.decodeFunctionResult('decimals', res),
          },
        ];
      })
      .flat(),
  }).then((res) => {
    const result: Array<{ name: string; symbol: string; decimals: number }> = [];
    for (let i = 0; i < res.length; i += 3) {
      result.push({
        name: res[i] as string,
        symbol: res[i + 1] as string,
        decimals: res[i + 2] as number,
      });
    }
    return result;
  });
};

export const fetchERC20AssetInfoBatchWithAccount = async ({
  networkType,
  endpoint,
  contractAddress,
  accountAddress,
}: {
  networkType: NetworkType;
  endpoint: string;
  contractAddress: string;
  accountAddress: Address;
}) => {
  const rpcPrefix = networkRpcPrefixMap[networkType];
  const rpcSuffix = networkRpcSuffixMap[networkType];
  const contract = createERC20Contract(contractAddress);

  return fetchChainBatch<Array<string>>({
    url: endpoint,
    rpcs: [
      {
        method: `${rpcPrefix}_call`,
        params: [{ to: contractAddress, data: contract.encodeFunctionData('name', []) }, rpcSuffix],
      },
      {
        method: `${rpcPrefix}_call`,
        params: [{ to: contractAddress, data: contract.encodeFunctionData('symbol', []) }, rpcSuffix],
      },
      {
        method: `${rpcPrefix}_call`,
        params: [{ to: contractAddress, data: contract.encodeFunctionData('decimals', []) }, rpcSuffix],
      },
      {
        method: `${rpcPrefix}_call`,
        params: [
          {
            to: contractAddress,
            data: contract.encodeFunctionData('balanceOf', [
              (networkType === NetworkType.Conflux ? convertCfxToHex(accountAddress.base32) : accountAddress.hex) as `0x${string}`,
            ]),
          },
          rpcSuffix,
        ],
      },
    ],
  }).then((res) => {
    return {
      name: contract.decodeFunctionResult('name', res[0])?.[0],
      symbol: contract.decodeFunctionResult('symbol', res[1])?.[0],
      decimals: typeof res[2] === 'string' && res[2].startsWith('0x') ? Number(contract.decodeFunctionResult('decimals', res[2])?.[0]) : undefined, // if res not hex string , it maybe an error , so return 1
      balance: contract.decodeFunctionResult('balanceOf', res[3])?.[0].toString(),
    };
  });
};

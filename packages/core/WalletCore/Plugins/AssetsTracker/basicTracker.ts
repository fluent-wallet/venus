import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { NetworkType } from '../../../database/models/Network';

const networkRpcPrefixMap = {
  [NetworkType.Conflux]: 'cfx',
  [NetworkType.Ethereum]: 'eth',
} as const;

const networkRpcSuffixMap = {
  [NetworkType.Conflux]: 'latest_state',
  [NetworkType.Ethereum]: 'latest',
} as const;

export const fetchNativeAsset = ({ networkType, endpoint, account }: { networkType: NetworkType; endpoint: string; account: string }) => {
  switch (networkType) {
    case NetworkType.Conflux:
    case NetworkType.Ethereum:
    default: {
      const rpcPrefix = networkRpcPrefixMap[networkType];
      const rpcSuffix = networkRpcSuffixMap[networkType];

      return fetchChain<string>({ url: endpoint, method: `${rpcPrefix}_getBalance`, params: [account, rpcSuffix] });
    }
  }
};

export const fetchConfluxNativeAsset = ({ endpoint, account }: { endpoint: string; account: string }) =>
  fetchNativeAsset({ networkType: NetworkType.Conflux, endpoint, account });

export const fetchEthereumNativeAsset = ({ endpoint, account }: { endpoint: string; account: string }) =>
  fetchNativeAsset({ networkType: NetworkType.Ethereum, endpoint, account });

export const fetchContractAsset = ({
  networkType,
  endpoint,
  account,
  contractAddress,
}: {
  networkType: NetworkType;
  endpoint: string;
  account: string;
  contractAddress: string;
}) => {
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
            to: '0xab4fa0d8a8dc3e2fb713a786248ce782bdae7111',
            data: `0x6352211e000000000000000000000000${'0x102e0fb8a5ed6e0f0899c3ed9896cb8973aa29bb'.slice(2)}000000000000000000000000${'13824'}`,
          },
          rpcSuffix,
        ],
      });
    }
  }
};

export const fetchConfluxContractAsset = ({ endpoint, account, contractAddress }: { endpoint: string; account: string; contractAddress: string }) =>
  fetchContractAsset({ networkType: NetworkType.Conflux, endpoint, account, contractAddress });

export const fetchEthereumContractAsset = ({ endpoint, account, contractAddress }: { endpoint: string; account: string; contractAddress: string }) =>
  fetchContractAsset({ networkType: NetworkType.Ethereum, endpoint, account, contractAddress });

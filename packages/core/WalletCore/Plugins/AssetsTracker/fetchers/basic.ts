import ERC20ABI from '@core/contracts/ABI/ERC777';
import MulticallABI from '@core/contracts/ABI/Multicall';
import { HttpJsonRpcClient } from '@core/rpc';
import type { Address as Base32Address } from 'cive';
import { base32AddressToHex } from 'cive/utils';
import { Interface } from 'ethers';
import type { Address } from '../../../../database/models/Address';
import { AssetType } from '../../../../database/models/Asset';
import { NetworkType, networkRpcPrefixMap, networkRpcSuffixMap } from '../../../../database/models/Network';

const erc20Interface = new Interface(ERC20ABI);
const multicallInterface = new Interface(MulticallABI);

type BalanceParams = { networkType: NetworkType; endpoint: string; accountAddress: Address };
type BalanceAsset = { contractAddress?: string | null; assetType?: Omit<AssetType, AssetType.ERC1155 | AssetType.ERC721> };
type TokenInfoParams = { networkType: NetworkType; endpoint: string; contractAddress: string };
type TokensInfoParams = { networkType: NetworkType; endpoint: string; assets: string[] };

export const fetchNativeAssetBalance = ({ networkType, endpoint, accountAddress }: BalanceParams) =>
  new HttpJsonRpcClient(endpoint).request<string>(`${networkRpcPrefixMap[networkType]}_getBalance`, [
    networkType === NetworkType.Conflux ? accountAddress.base32 : accountAddress.hex,
    networkRpcSuffixMap[networkType],
  ]);

export const fetchConfluxNativeAssetBalance = (params: Omit<BalanceParams, 'networkType'>) =>
  fetchNativeAssetBalance({ ...params, networkType: NetworkType.Conflux });

export const fetchEthereumNativeAssetBalance = (params: Omit<BalanceParams, 'networkType'>) =>
  fetchNativeAssetBalance({ ...params, networkType: NetworkType.Ethereum });

export const fetchContractAssetBalance = ({ networkType, endpoint, accountAddress, contractAddress }: BalanceParams & { contractAddress: string }) =>
  new HttpJsonRpcClient(endpoint).request<string>(`${networkRpcPrefixMap[networkType]}_call`, [
    { to: contractAddress, data: erc20Interface.encodeFunctionData('balanceOf', [accountAddress.hex]) },
    networkRpcSuffixMap[networkType],
  ]);

export const fetchConfluxERC20AssetBalance = (params: Omit<BalanceParams, 'networkType'> & { contractAddress: string }) =>
  fetchContractAssetBalance({ ...params, networkType: NetworkType.Conflux });

export const fetchEthereumERC20AssetBalance = (params: Omit<BalanceParams, 'networkType'> & { contractAddress: string }) =>
  fetchContractAssetBalance({ ...params, networkType: NetworkType.Ethereum });

export const fetchAssetsBalance = ({ assets, ...params }: BalanceParams & { assets: BalanceAsset[] }) =>
  Promise.all(
    assets.map(({ contractAddress, assetType }) =>
      assetType === AssetType.ERC20 && contractAddress ? fetchContractAssetBalance({ ...params, contractAddress }) : fetchNativeAssetBalance(params),
    ),
  );

export const fetchAssetsBalanceBatch = ({ endpoint, accountAddress, assets, networkType }: BalanceParams & { assets: BalanceAsset[] }) => {
  if (assets.some(({ assetType, contractAddress }) => !assetType && !contractAddress)) {
    throw new Error('assetType or contractAddress is required');
  }
  const rpcPrefix = networkRpcPrefixMap[networkType];
  return new HttpJsonRpcClient(endpoint).batch<string>(
    assets.map(({ assetType, contractAddress }) => ({
      method: assetType === AssetType.Native ? `${rpcPrefix}_getBalance` : `${rpcPrefix}_call`,
      params: [
        assetType === AssetType.Native
          ? networkType === NetworkType.Conflux
            ? accountAddress.base32
            : accountAddress.hex
          : { to: contractAddress, data: erc20Interface.encodeFunctionData('balanceOf', [accountAddress.hex]) },
        networkRpcSuffixMap[networkType],
      ],
    })),
  );
};

export const fetchAssetsBalanceMulticall = async ({
  endpoint,
  accountAddress,
  assets,
  networkType,
  multicallContractAddress,
}: BalanceParams & { assets: BalanceAsset[]; multicallContractAddress: string }): Promise<string[]> => {
  if (assets.some(({ assetType, contractAddress }) => !assetType && !contractAddress)) {
    throw new Error('assetType or contractAddress is required');
  }
  const contractAssets = assets.filter(({ assetType }) => assetType !== AssetType.Native);
  const nativeBalance = assets.some(({ assetType }) => assetType === AssetType.Native)
    ? fetchNativeAssetBalance({ networkType, endpoint, accountAddress })
    : undefined;
  const contractBalances = contractAssets.length
    ? new HttpJsonRpcClient(endpoint)
        .request<string>(`${networkRpcPrefixMap[networkType]}_call`, [
          {
            to: multicallContractAddress,
            data: multicallInterface.encodeFunctionData('aggregate', [
              contractAssets.map(({ contractAddress }) => [
                networkType === NetworkType.Conflux ? base32AddressToHex({ address: contractAddress as Base32Address }) : contractAddress,
                erc20Interface.encodeFunctionData('balanceOf', [accountAddress.hex]),
              ]),
            ]),
          },
          networkRpcSuffixMap[networkType],
        ])
        .then((raw) => Array.from<string>(multicallInterface.decodeFunctionResult('aggregate', raw)[1]))
    : Promise.resolve<string[]>([]);

  const [native, contracts] = await Promise.all([nativeBalance, contractBalances]);
  let contractIndex = 0;
  return assets.map(({ assetType }) => (assetType === AssetType.Native ? native! : contracts[contractIndex++]));
};

const decodeTokenInfo = (results: readonly string[]) => ({
  name: String(erc20Interface.decodeFunctionResult('name', results[0])[0]),
  symbol: String(erc20Interface.decodeFunctionResult('symbol', results[1])[0]),
  decimals: Number(erc20Interface.decodeFunctionResult('decimals', results[2])[0]),
});

export const fetchERC20ContractAssetInfo = async ({ networkType, endpoint, contractAddress }: TokenInfoParams) => {
  const rpc = new HttpJsonRpcClient(endpoint);
  const results = await Promise.all(
    ['name', 'symbol', 'decimals'].map((method) =>
      rpc.request<string>(`${networkRpcPrefixMap[networkType]}_call`, [
        { to: contractAddress, data: erc20Interface.encodeFunctionData(method, []) },
        networkRpcSuffixMap[networkType],
      ]),
    ),
  );
  return decodeTokenInfo(results);
};

export const fetchERC20AssetInfoBatch = async ({ networkType, endpoint, contractAddress }: TokenInfoParams) => {
  const results = await new HttpJsonRpcClient(endpoint).batch<string>(
    ['name', 'symbol', 'decimals'].map((method) => ({
      method: `${networkRpcPrefixMap[networkType]}_call`,
      params: [{ to: contractAddress, data: erc20Interface.encodeFunctionData(method, []) }, networkRpcSuffixMap[networkType]],
    })),
  );
  return decodeTokenInfo(results);
};

export const fetchERC20ContractAssetsInfo = ({ networkType, endpoint, assets }: TokensInfoParams) =>
  Promise.all(assets.map((contractAddress) => fetchERC20ContractAssetInfo({ networkType, endpoint, contractAddress })));

export const fetchERC20AssetsInfoBatch = async ({ networkType, endpoint, assets }: TokensInfoParams) => {
  const results = await new HttpJsonRpcClient(endpoint).batch<string>(
    assets.flatMap((contractAddress) =>
      ['name', 'symbol', 'decimals'].map((method) => ({
        method: `${networkRpcPrefixMap[networkType]}_call`,
        params: [{ to: contractAddress, data: erc20Interface.encodeFunctionData(method, []) }, networkRpcSuffixMap[networkType]],
      })),
    ),
  );
  return assets.map((_, index) => decodeTokenInfo(results.slice(index * 3, index * 3 + 3)));
};

export const fetchERC20AssetsInfoMulticall = async ({
  networkType,
  endpoint,
  assets,
  multicallContractAddress,
}: TokensInfoParams & { multicallContractAddress: string }) => {
  if (assets.length === 0) return [];
  const calls = assets.flatMap((contractAddress) =>
    ['name', 'symbol', 'decimals'].map((method) => [
      networkType === NetworkType.Conflux ? base32AddressToHex({ address: contractAddress as Base32Address }) : contractAddress,
      erc20Interface.encodeFunctionData(method, []),
    ]),
  );
  const raw = await new HttpJsonRpcClient(endpoint).request<string>(`${networkRpcPrefixMap[networkType]}_call`, [
    { to: multicallContractAddress, data: multicallInterface.encodeFunctionData('aggregate', [calls]) },
    networkRpcSuffixMap[networkType],
  ]);
  const results = Array.from<string>(multicallInterface.decodeFunctionResult('aggregate', raw)[1]);
  return assets.map((_, index) => decodeTokenInfo(results.slice(index * 3, index * 3 + 3)));
};

export const fetchERC20AssetInfoMulticall = async ({ contractAddress, ...params }: TokenInfoParams & { multicallContractAddress: string }) => {
  const [info] = await fetchERC20AssetsInfoMulticall({ ...params, assets: [contractAddress] });
  return { name: info.name, symbol: info.symbol, decimal: info.decimals };
};

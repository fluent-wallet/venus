import ERC20ABI from '@core/contracts/ABI/ERC777';
import MulticallABI from '@core/contracts/ABI/Multicall';
import type { Address } from '@core/database/models/Address';
import { AssetType } from '@core/database/models/Asset';
import { NetworkType } from '@core/database/models/Network';
import { CHAIN_RPC_ERROR_RESPONSE } from '@core/errors';
import { Interface } from 'ethers';
import { fetchAssetsBalanceBatch, fetchAssetsBalanceMulticall, fetchERC20AssetsInfoMulticall } from './basic';

jest.mock('@core/database/models/Asset', () => ({ AssetType: { Native: 'Native', ERC20: 'ERC20' } }));
jest.mock('@core/database/models/Network', () => ({
  NetworkType: { Ethereum: 'Ethereum', Conflux: 'Conflux' },
  networkRpcPrefixMap: { Ethereum: 'eth', Conflux: 'cfx' },
  networkRpcSuffixMap: { Ethereum: 'latest', Conflux: 'latest_state' },
}));

const erc20 = new Interface(ERC20ABI);
const multicall = new Interface(MulticallABI);
const accountAddress = { hex: '0x1000000000000000000000000000000000000001', base32: 'cfxtest:account' } as Address;
const tokenA = '0x8000000000000000000000000000000000000001';
const tokenB = '0x8000000000000000000000000000000000000002';
const aggregateAddress = '0x8000000000000000000000000000000000000003';
const endpoint = 'https://custom-rpc.example';
const createResponse = (json: unknown) => ({ ok: true, json: async () => json }) as Response;
const originalFetch = globalThis.fetch;

describe('asset RPC reads', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('maps Multicall aggregate results to their original positions around native assets', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const { id, method, params } = JSON.parse(init!.body as string);
      if (method === 'eth_getBalance') return createResponse({ jsonrpc: '2.0', id, result: '0x10' });
      expect(method).toBe('eth_call');
      expect(params[0].to).toBe(aggregateAddress);
      expect(params[1]).toBe('latest');
      const calls = multicall.decodeFunctionData('aggregate', params[0].data)[0];
      expect(calls.map((call: { target: string }) => call.target.toLowerCase())).toEqual([tokenA, tokenB]);
      const result = multicall.encodeFunctionResult('aggregate', [
        1n,
        [erc20.encodeFunctionResult('balanceOf', [7n]), erc20.encodeFunctionResult('balanceOf', [9n])],
      ]);
      return createResponse({ jsonrpc: '2.0', id, result });
    });
    const result = await fetchAssetsBalanceMulticall({
      endpoint,
      accountAddress,
      networkType: NetworkType.Ethereum,
      multicallContractAddress: aggregateAddress,
      assets: [
        { assetType: AssetType.ERC20, contractAddress: tokenA },
        { assetType: AssetType.Native },
        { assetType: AssetType.ERC20, contractAddress: tokenB },
        { assetType: AssetType.Native },
      ],
    });
    expect(result).toEqual([erc20.encodeFunctionResult('balanceOf', [7n]), '0x10', erc20.encodeFunctionResult('balanceOf', [9n]), '0x10']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends Core RPC methods and epoch tags for custom endpoint domains', async () => {
    const tokenBalance = erc20.encodeFunctionResult('balanceOf', [7n]);
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const requests = JSON.parse(init!.body as string);
      expect(requests.map((request: { method: string }) => request.method)).toEqual(['cfx_getBalance', 'cfx_call']);
      expect(requests.map((request: { params: unknown[] }) => request.params[1])).toEqual(['latest_state', 'latest_state']);
      expect(requests[0].params[0]).toBe(accountAddress.base32);
      return createResponse(
        requests
          .map(({ id, method }: { id: number; method: string }) => ({ jsonrpc: '2.0', id, result: method === 'cfx_getBalance' ? '0x10' : tokenBalance }))
          .reverse(),
      );
    });
    await expect(
      fetchAssetsBalanceBatch({
        endpoint,
        accountAddress,
        networkType: NetworkType.Conflux,
        assets: [{ assetType: AssetType.Native }, { assetType: AssetType.ERC20, contractAddress: 'cfxtest:token' }],
      }),
    ).resolves.toEqual(['0x10', tokenBalance]);
  });

  it('decodes every token metadata tuple after an aggregate call', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const { id, params } = JSON.parse(init!.body as string);
      expect(multicall.decodeFunctionData('aggregate', params[0].data)[0]).toHaveLength(6);
      const result = multicall.encodeFunctionResult('aggregate', [
        1n,
        [
          erc20.encodeFunctionResult('name', ['One']),
          erc20.encodeFunctionResult('symbol', ['ONE']),
          erc20.encodeFunctionResult('decimals', [6]),
          erc20.encodeFunctionResult('name', ['Two']),
          erc20.encodeFunctionResult('symbol', ['TWO']),
          erc20.encodeFunctionResult('decimals', [18]),
        ],
      ]);
      return createResponse({ jsonrpc: '2.0', id, result });
    });
    await expect(
      fetchERC20AssetsInfoMulticall({ endpoint, networkType: NetworkType.Ethereum, assets: [tokenA, tokenB], multicallContractAddress: aggregateAddress }),
    ).resolves.toEqual([
      { name: 'One', symbol: 'ONE', decimals: 6 },
      { name: 'Two', symbol: 'TWO', decimals: 18 },
    ]);
  });

  it('propagates an aggregate revert so the caller can choose its fallback', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(createResponse({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'execution reverted' } }));
    await expect(
      fetchAssetsBalanceMulticall({
        endpoint,
        accountAddress,
        networkType: NetworkType.Ethereum,
        multicallContractAddress: aggregateAddress,
        assets: [{ assetType: AssetType.ERC20, contractAddress: tokenA }],
      }),
    ).rejects.toMatchObject({ code: CHAIN_RPC_ERROR_RESPONSE });
  });

  it('does not request an aggregate for empty input', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    await expect(
      fetchAssetsBalanceMulticall({ endpoint, accountAddress, networkType: NetworkType.Ethereum, multicallContractAddress: aggregateAddress, assets: [] }),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

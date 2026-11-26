import ESpaceTokenListABI from '@core/contracts/ABI/ESpaceTokenList';
import ESpaceWalletABI from '@core/contracts/ABI/ESpaceWallet';
import { AssetType } from '@core/database/models/Asset';
import { ChainType, type Network } from '@core/database/models/Network';
import { Interface } from 'ethers';
import { fetchReceiveAssets } from '../../ReceiveAssetsTracker/fetchers/eSpace';
import { fetchESpaceServer } from './eSpaceServer';

const mockScanGet = jest.fn();
jest.mock('ky', () => ({
  __esModule: true,
  default: {
    create: ({ prefixUrl }: { prefixUrl: string }) => ({
      get: (url: string, options?: unknown) => ({ json: () => mockScanGet(prefixUrl, url, options) }),
    }),
  },
}));
jest.mock('@core/database/models/Asset', () => ({ AssetType: { Native: 'Native', ERC20: 'ERC20' } }));
jest.mock('@core/database/models/Network', () => ({ ChainType: { Mainnet: 'Mainnet', Testnet: 'Testnet' } }));
jest.mock('@core/utils/consts', () => ({
  Networks: {
    'Conflux eSpace': { scanOpenAPI: 'https://scan-main.example' },
    'eSpace Testnet': { scanOpenAPI: 'https://scan-test.example' },
  },
}));

const walletInterface = new Interface(ESpaceWalletABI);
const tokenListInterface = new Interface(ESpaceTokenListABI);
const account = '0x1111111111111111111111111111111111111111';
const token = '0x2222222222222222222222222222222222222222';
const endpoint = 'https://rpc.example';
const network = { endpoint } as Network;
const originalFetch = globalThis.fetch;
const response = (json: unknown) => ({ ok: true, json: async () => json }) as Response;

describe('eSpace Scan and RPC integration', () => {
  beforeEach(() => {
    mockScanGet.mockReset();
    globalThis.fetch = jest.fn();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('falls back to contract discovery when the Scan request fails', async () => {
    mockScanGet.mockRejectedValue(new Error('Scan unavailable'));
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const requests = JSON.parse(init!.body as string);
      const call = requests.find(({ method }: { method: string }) => method === 'eth_call');
      expect(walletInterface.decodeFunctionData('assets', call.params[0].data)[0]).toBe(account);
      return response([
        { jsonrpc: '2.0', id: call.id, result: walletInterface.encodeFunctionResult('assets', [1n, [[[token, 'Token', 'TOK', 6], 123n]]]) },
        { jsonrpc: '2.0', id: requests[0].id, result: '0x10' },
      ]);
    });
    await expect(fetchESpaceServer({ hexAddress: account, chainType: ChainType.Mainnet, network })).resolves.toEqual([
      expect.objectContaining({ type: AssetType.Native, balance: '0x10' }),
      expect.objectContaining({ type: AssetType.ERC20, contractAddress: token, name: 'Token', symbol: 'TOK', decimals: 6, balance: '123' }),
    ]);
  });

  it('combines Scan metadata with balances returned in a different batch order', async () => {
    mockScanGet.mockResolvedValue({
      status: '1',
      message: 'OK',
      result: { list: [{ type: 'ERC20', contract: token, priceInUSDT: '2.5', iconUrl: 'https://token.example/icon' }] },
    });
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const requests = JSON.parse(init!.body as string);
      const args = walletInterface.decodeFunctionData('assetsOf', requests[1].params[0].data);
      expect(Array.from(args[1])).toEqual([token]);
      return response([
        { jsonrpc: '2.0', id: requests[1].id, result: walletInterface.encodeFunctionResult('assetsOf', [[[[token, 'Token', 'TOK', 6], 123n]]]) },
        { jsonrpc: '2.0', id: requests[0].id, result: '0x10' },
      ]);
    });
    const assets = await fetchESpaceServer({ hexAddress: account, chainType: ChainType.Mainnet, network });
    expect(assets[1]).toMatchObject({ contractAddress: token, balance: '123', decimals: 6, priceInUSDT: '2.5', icon: 'https://token.example/icon' });
    expect(mockScanGet.mock.calls[0][0]).toBe('https://scan-main.example');
  });

  it('reads the token list at latest before requesting token metadata from the matching Scan server', async () => {
    mockScanGet.mockResolvedValue({ result: [{ contract: token, name: 'Token', symbol: 'TOK', decimals: 6 }] });
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const request = JSON.parse(init!.body as string);
      expect(request.method).toBe('eth_call');
      expect(request.params[1]).toBe('latest');
      expect(request.params[0].to).toBe('0xcd54f022b0355e00db610f6b3411c76b5c61320f');
      expect(Array.from(tokenListInterface.decodeFunctionData('listTokens', request.params[0].data))).toEqual([20n, 0n, 200n]);
      return response({ jsonrpc: '2.0', id: request.id, result: tokenListInterface.encodeFunctionResult('listTokens', [1n, [token]]) });
    });
    await expect(fetchReceiveAssets({ endpoint, isTestnet: true })).resolves.toEqual([
      { contractAddress: token, name: 'Token', symbol: 'TOK', decimals: 6, type: AssetType.ERC20, balance: '0', icon: undefined },
    ]);
    expect(mockScanGet).toHaveBeenCalledWith('https://scan-test.example', 'token/tokeninfos', { searchParams: { contracts: token } });
  });
});

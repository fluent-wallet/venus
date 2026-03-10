import ESpaceWalletABI from '@core/contracts/ABI/ESpaceWallet';
import { ASSET_TYPE, type AssetTypeValue, type Hex } from '@core/types';
import { Interface } from '@ethersproject/abi';
import { getAddress as toChecksumAddress } from 'ethers';
import { injectable } from 'inversify';
import type { AssetDiscoveryInput, DiscoveredFungibleAsset, IAssetDiscoveryProvider } from '../types';
import { NetworkType } from '@core/utils/consts';

const eSpaceWalletIface = new Interface(ESpaceWalletABI);
const NATIVE_ASSET_KEY = 'native';

const E_SPACE_DISCOVERY_CONFIG_BY_CHAIN_ID: Record<string, { walletContract: string; scanOpenApiBaseUrl: string }> = {
  '0x406': {
    walletContract: '0x2c7e015328f37f00f9b16e4adc9cedb1f8742069',
    scanOpenApiBaseUrl: 'https://evmapi.confluxscan.org',
  },
  '0x47': {
    walletContract: '0xce2104aa7233b27b0ba2e98ede59b6f78c06ae05',
    scanOpenApiBaseUrl: 'https://evmapi-testnet.confluxscan.org',
  },
};

type ScanTokenItem = {
  type?: unknown;
  contract?: unknown;
  priceInUSDT?: unknown;
  iconUrl?: unknown;
};

@injectable()
export class ESpaceAssetDiscoveryProvider implements IAssetDiscoveryProvider {
  supports(input: { chainId: string; networkType: NetworkType }): boolean {
    return input.networkType === NetworkType.Ethereum && Boolean(E_SPACE_DISCOVERY_CONFIG_BY_CHAIN_ID[input.chainId.toLowerCase()]);
  }

  async discoverFungibleAssets(input: AssetDiscoveryInput): Promise<DiscoveredFungibleAsset[] | null> {
    const config = E_SPACE_DISCOVERY_CONFIG_BY_CHAIN_ID[input.network.chainId.toLowerCase()];
    if (!config) {
      return null;
    }

    const fromScan = await this.fetchFromScan(input, config);
    if (fromScan) {
      return fromScan;
    }

    try {
      return await this.fetchFromChain(input, config);
    } catch {
      return null;
    }
  }

  private async fetchFromScan(
    input: AssetDiscoveryInput,
    config: { walletContract: string; scanOpenApiBaseUrl: string },
  ): Promise<DiscoveredFungibleAsset[] | null> {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
      return null;
    }

    let response: Response;
    try {
      const url = new URL('/account/tokens', config.scanOpenApiBaseUrl);
      url.searchParams.set('account', input.address.hex);
      response = await fetchFn(url.toString(), { method: 'GET' });
    } catch {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return null;
    }

    const scanTokens = this.extractScanTokens(json);
    if (scanTokens === null) {
      return null;
    }

    const scanInfoByKey = new Map<string, { type: AssetTypeValue; priceInUSDT: string | null; icon: string | null }>();
    const tokenContracts: string[] = [];

    for (const token of scanTokens) {
      const type = this.parseScanAssetType(token.type);
      if (!type) {
        continue;
      }

      if (type === ASSET_TYPE.Native) {
        scanInfoByKey.set(NATIVE_ASSET_KEY, {
          type,
          priceInUSDT: this.toOptionalTrimmedString(token.priceInUSDT),
          icon: this.toOptionalTrimmedString(token.iconUrl),
        });
        continue;
      }

      const contractAddress = this.toChecksumAddressOrNull(token.contract);
      if (!contractAddress) {
        continue;
      }

      scanInfoByKey.set(contractAddress.toLowerCase(), {
        type,
        priceInUSDT: this.toOptionalTrimmedString(token.priceInUSDT),
        icon: this.toOptionalTrimmedString(token.iconUrl),
      });

      if (!tokenContracts.includes(contractAddress)) {
        tokenContracts.push(contractAddress);
      }
    }

    if (tokenContracts.length === 0) {
      const nativeBalance = await input.chainProvider.getBalance(input.address.hex);
      const nativeAsset = this.createNativeAsset(nativeBalance, scanInfoByKey.get(NATIVE_ASSET_KEY));
      return [nativeAsset];
    }

    let nativeBalance: Hex;
    let raw: Hex;
    try {
      [nativeBalance, raw] = await this.batchReadNativeBalanceAndCall(input, {
        to: config.walletContract,
        data: eSpaceWalletIface.encodeFunctionData('assetsOf', [input.address.hex, tokenContracts]) as Hex,
      });
    } catch {
      return null;
    }

    const nativeAsset = this.createNativeAsset(nativeBalance, scanInfoByKey.get(NATIVE_ASSET_KEY));
    if (!raw || raw === '0x') {
      return [nativeAsset];
    }

    const decoded = eSpaceWalletIface.decodeFunctionResult('assetsOf', raw);
    const walletAssets = Array.isArray((decoded as unknown as any[])?.[0]) ? ((decoded as unknown as any[])[0] as any[]) : [];

    return [nativeAsset, ...this.mapWalletAssets(walletAssets, scanInfoByKey)];
  }

  private async fetchFromChain(input: AssetDiscoveryInput, config: { walletContract: string; scanOpenApiBaseUrl: string }): Promise<DiscoveredFungibleAsset[]> {
    const [nativeBalance, raw] = await this.batchReadNativeBalanceAndCall(input, {
      to: config.walletContract,
      data: eSpaceWalletIface.encodeFunctionData('assets', [input.address.hex, 20n, 0n, 100n]) as Hex,
    });

    const nativeAsset = this.createNativeAsset(nativeBalance);
    if (!raw || raw === '0x') {
      return [nativeAsset];
    }

    const decoded = eSpaceWalletIface.decodeFunctionResult('assets', raw);
    const walletAssets = Array.isArray((decoded as unknown as any[])?.[1]) ? ((decoded as unknown as any[])[1] as any[]) : [];

    return [nativeAsset, ...this.mapWalletAssets(walletAssets)];
  }

  private mapWalletAssets(
    walletAssets: any[],
    scanInfoByKey?: Map<string, { type: AssetTypeValue; priceInUSDT: string | null; icon: string | null }>,
  ): DiscoveredFungibleAsset[] {
    const assets: DiscoveredFungibleAsset[] = [];

    for (const walletAsset of walletAssets) {
      const { contractAddress, name, symbol, decimals } = this.readWalletAssetTokenInfo(walletAsset);
      if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
        continue;
      }

      const info = scanInfoByKey?.get(contractAddress.toLowerCase());
      assets.push({
        type: info?.type ?? ASSET_TYPE.ERC20,
        contractAddress,
        name,
        symbol,
        decimals,
        icon: info?.icon ?? null,
        priceInUSDT: info?.priceInUSDT ?? null,
        balanceBaseUnits: this.readWalletAssetBalance(walletAsset),
      });
    }

    return assets;
  }

  private async batchReadNativeBalanceAndCall(input: AssetDiscoveryInput, call: { to: string; data: Hex }): Promise<[Hex, Hex]> {
    try {
      const [nativeBalance, raw] = await input.chainProvider.rpc.batch<Hex>([
        { method: 'eth_getBalance', params: [input.address.hex, 'latest'] },
        { method: 'eth_call', params: [{ to: call.to, data: call.data }, 'latest'] },
      ]);

      return [nativeBalance, raw];
    } catch {
      const [nativeBalance, raw] = await Promise.all([input.chainProvider.getBalance(input.address.hex), input.chainProvider.call(call)]);
      return [nativeBalance, raw];
    }
  }

  private readWalletAssetTokenInfo(walletAsset: any): {
    contractAddress: string | null;
    name: string | null;
    symbol: string | null;
    decimals: number | null;
  } {
    const token = walletAsset?.token;
    const contractAddress = this.toChecksumAddressOrNull(Array.isArray(token) ? token[0] : token?.token);
    const name = this.toOptionalTrimmedString(Array.isArray(token) ? token[1] : token?.name);
    const symbol = this.toOptionalTrimmedString(Array.isArray(token) ? token[2] : token?.symbol);
    const decimalsRaw = Array.isArray(token) ? token[3] : token?.decimals;
    const decimals = typeof decimalsRaw === 'number' ? decimalsRaw : Number(decimalsRaw ?? 18);

    return {
      contractAddress,
      name,
      symbol,
      decimals: Number.isFinite(decimals) ? decimals : 18,
    };
  }

  private readWalletAssetBalance(walletAsset: any): string {
    const balance = walletAsset?.balance;
    if (typeof balance === 'bigint') {
      return balance.toString();
    }
    if (typeof balance === 'string') {
      return balance;
    }
    if (typeof balance === 'number') {
      return String(balance);
    }
    return String(balance ?? '0');
  }

  private createNativeAsset(
    nativeBalance: Hex,
    info?: {
      type: AssetTypeValue;
      priceInUSDT: string | null;
      icon: string | null;
    },
  ): DiscoveredFungibleAsset {
    return {
      type: ASSET_TYPE.Native,
      contractAddress: null,
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18,
      icon: info?.icon ?? null,
      priceInUSDT: info?.priceInUSDT ?? null,
      balanceBaseUnits: nativeBalance && nativeBalance !== '0x' ? BigInt(nativeBalance).toString() : '0',
    };
  }

  private extractScanTokens(json: unknown): ScanTokenItem[] | null {
    if (!json || typeof json !== 'object') {
      return null;
    }

    const status = 'status' in json ? json.status : undefined;
    if (status !== '1') {
      const message = 'message' in json ? json.message : undefined;
      if (typeof message === 'string' && message.includes('The parameter is wrong, please confirm it is correct')) {
        return [];
      }
      return null;
    }

    const result = 'result' in json ? json.result : undefined;
    const list = result && typeof result === 'object' && 'list' in result ? result.list : undefined;
    return Array.isArray(list) ? (list as ScanTokenItem[]) : [];
  }

  private parseScanAssetType(value: unknown): AssetTypeValue | null {
    if (value === 'native') {
      return ASSET_TYPE.Native;
    }
    if (value === ASSET_TYPE.ERC20) {
      return ASSET_TYPE.ERC20;
    }
    return null;
  }

  private toOptionalTrimmedString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  }

  private toChecksumAddressOrNull(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    try {
      return toChecksumAddress(value.trim());
    } catch {
      return null;
    }
  }
}

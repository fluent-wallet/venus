import { ChainRegistry } from '@core/chains';
import { iface721, iface777, iface1155 } from '@core/contracts';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import { type Asset, AssetSource as DbAssetSource, AssetType as DbAssetType } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CHAIN_PROVIDER_NOT_FOUND, CoreError } from '@core/errors';
import { ASSET_SOURCE, ASSET_TYPE, type AssetSource, type AssetTypeValue, type Hex, type IChainProvider } from '@core/types';
import { type Base32Address, convertBase32ToHex } from '@core/utils/address';
import { balanceFormat, convertBalanceToDecimal, truncate } from '@core/utils/balance';
import { NetworkType } from '@core/utils/consts';
import Decimal from 'decimal.js';
import { inject, injectable } from 'inversify';
import { AssetDiscoveryRegistry } from './discovery/AssetDiscoveryRegistry';
import type { DiscoveredFungibleAsset } from './discovery/types';
import type { AddCustomTokenInput, ContractAssetInspection, Erc20TokenInfo, IAsset } from './types';

const ERC1155_INTERFACE_ID = '0xd9b67a26';
const ERC721_INTERFACE_ID = '0x80ac58cd';
const NATIVE_ASSET_KEY = 'native';

const ASSET_TYPE_BY_DB_ASSET_TYPE: Record<DbAssetType, AssetTypeValue> = {
  [DbAssetType.Native]: ASSET_TYPE.Native,
  [DbAssetType.ERC20]: ASSET_TYPE.ERC20,
  [DbAssetType.ERC721]: ASSET_TYPE.ERC721,
  [DbAssetType.ERC1155]: ASSET_TYPE.ERC1155,
} as const;

const ASSET_SOURCE_BY_DB_ASSET_SOURCE: Record<DbAssetSource, AssetSource> = {
  [DbAssetSource.Custom]: ASSET_SOURCE.Custom,
  [DbAssetSource.Official]: ASSET_SOURCE.Official,
} as const;

type NormalizedBalance = {
  value: string;
  formatted: string;
};

type AddressAssetContext = {
  address: Address;
  addressValue: string;
  assetRuleId: string;
  network: Network;
  trackedAssets: Asset[];
};

type ERC20MethodReturnType<T extends string> = T extends 'name' | 'symbol' ? string : T extends 'decimals' ? number : T extends 'balanceOf' ? Hex : never;

@injectable()
export class AssetService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  @inject(AssetDiscoveryRegistry)
  private readonly assetDiscoveryRegistry!: AssetDiscoveryRegistry;

  async getAssetsByAddress(addressId: string): Promise<IAsset[]> {
    const address = await this.findAddress(addressId);
    const context = await this.readAddressAssetContext(address);
    const fungibleAssets = await this.buildFungibleAssets(context);
    const nonFungibleAssets = this.buildNonFungibleAssets(context.trackedAssets);
    return [...this.orderFungibleAssets(fungibleAssets), ...nonFungibleAssets];
  }

  async getAssetBalance(addressId: string, assetId: string): Promise<string> {
    const address = await this.findAddress(addressId);
    const asset = await this.findAsset(assetId);
    if (this.isNonFungibleAsset(asset)) {
      throw new Error('Asset balance is not applicable for non-fungible assets. Use NftService for NFT ownership details.');
    }
    const balance = await this.fetchFungibleAssetBalance(address, asset);
    return balance.value;
  }

  /**
   * Resolve ERC20 metadata + balance for a given contract address, scoped to an address.
   * Used by WalletConnect transaction UI to keep legacy "approve allowance" rendering behavior.
   */
  async getErc20TokenInfo(input: { addressId: string; contractAddress: string }): Promise<Erc20TokenInfo> {
    const address = await this.findAddress(input.addressId);
    const network = await address.network.fetch();
    const provider = this.getChainProvider(network);

    const owner = await address.getValue();
    const ownerForCalldata = this.resolveCalldataAddress(owner, network.networkType);

    const [name, symbol, decimalsRaw, balanceRaw] = await Promise.all([
      this.callERC20Method(provider, input.contractAddress, 'name', []),
      this.callERC20Method(provider, input.contractAddress, 'symbol', []),
      this.callERC20Method(provider, input.contractAddress, 'decimals', []),
      this.callERC20Method(provider, input.contractAddress, 'balanceOf', [ownerForCalldata]),
    ]);

    const decimals = typeof decimalsRaw === 'number' && Number.isFinite(decimalsRaw) ? decimalsRaw : 18;
    const balance = typeof balanceRaw === 'string' && balanceRaw.startsWith('0x') ? BigInt(balanceRaw).toString() : '0';

    return {
      name: typeof name === 'string' && name.trim() !== '' ? name : null,
      symbol: typeof symbol === 'string' && symbol.trim() !== '' ? symbol : null,
      decimals,
      balance,
    };
  }

  async inspectContractAsset(input: { addressId: string; contractAddress: string }): Promise<ContractAssetInspection> {
    const address = await this.findAddress(input.addressId);
    const network = await address.network.fetch();

    if (network.networkType !== NetworkType.Ethereum) {
      return { assetType: null, name: null, symbol: null, decimals: null, balance: null };
    }

    const provider = this.getChainProvider(network);
    const nftType = await this.detectNftContractType(provider, input.contractAddress);
    if (nftType) {
      return { assetType: nftType, name: null, symbol: null, decimals: null, balance: null };
    }

    const tokenInfo = await this.getErc20TokenInfo(input);
    const assetType = tokenInfo.name && tokenInfo.symbol ? ASSET_TYPE.ERC20 : null;

    return {
      assetType,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: assetType ? tokenInfo.decimals : null,
      balance: assetType ? tokenInfo.balance : null,
    };
  }

  async addCustomToken(input: AddCustomTokenInput): Promise<IAsset> {
    const address = await this.findAddress(input.addressId);
    const assetRule = await address.assetRule.fetch();
    const network = await address.network.fetch();
    const existing = await assetRule.assets.fetch();

    if (existing.some((asset) => asset.contractAddress?.toLowerCase() === input.contractAddress.toLowerCase())) {
      throw new Error('Token already exists in this asset rule.');
    }

    const metadata = await this.resolveTokenMetadata(network, input.contractAddress, input);

    const asset = await this.database.write(async () => {
      return this.database.get<Asset>(TableName.Asset).create((record) => {
        record.assetRule.set(assetRule);
        record.network.set(network);
        record.type = DbAssetType.ERC20;
        record.contractAddress = input.contractAddress;
        record.name = metadata.name ?? null;
        record.symbol = metadata.symbol ?? null;
        record.decimals = metadata.decimals ?? 18;
        record.icon = metadata.icon ?? null;
        record.source = DbAssetSource.Custom;
        record.priceInUSDT = null;
      });
    });

    const balance = await this.fetchFungibleAssetBalance(address, asset);
    return this.toInterface(asset, balance);
  }

  private async findAddress(addressId: string): Promise<Address> {
    try {
      return await this.database.get<Address>(TableName.Address).find(addressId);
    } catch {
      throw new Error(`[AssetService] Address ${addressId} not found in database.`);
    }
  }

  private async findAsset(assetId: string): Promise<Asset> {
    try {
      return await this.database.get<Asset>(TableName.Asset).find(assetId);
    } catch {
      throw new Error(`Asset ${assetId} not found.`);
    }
  }

  private getChainProvider(network: Network): IChainProvider {
    const provider = this.chainRegistry.get(network.chainId, network.networkType);
    if (!provider) {
      throw new CoreError({
        code: CHAIN_PROVIDER_NOT_FOUND,
        message: 'Chain provider is not registered in ChainRegistry.',
        context: { chainId: network.chainId, networkType: network.networkType },
      });
    }
    return provider;
  }

  private isNonFungibleAsset(asset: Asset): boolean {
    return asset.type === DbAssetType.ERC721 || asset.type === DbAssetType.ERC1155;
  }

  private async readAddressAssetContext(address: Address): Promise<AddressAssetContext> {
    const [assetRule, network, addressValue] = await Promise.all([address.assetRule.fetch(), address.network.fetch(), address.getValue()]);
    const trackedAssets = await assetRule.assets.fetch();

    return {
      address,
      addressValue,
      assetRuleId: assetRule.id,
      network,
      trackedAssets,
    };
  }

  private buildNonFungibleAssets(trackedAssets: Asset[]): IAsset[] {
    return trackedAssets.filter((asset) => this.isNonFungibleAsset(asset)).map((asset) => this.toInterface(asset, { value: '0', formatted: '0' }));
  }

  private listTrackedFungibleAssets(trackedAssets: Asset[]): Asset[] {
    return trackedAssets.filter((asset) => !this.isNonFungibleAsset(asset));
  }

  private async buildFungibleAssets(context: AddressAssetContext): Promise<IAsset[]> {
    const trackedFungibleAssets = this.listTrackedFungibleAssets(context.trackedAssets);
    const discoveredSnapshots = await this.discoverFungibleAssets({
      address: { value: context.addressValue, hex: context.address.hex },
      network: context.network,
    });

    if (!discoveredSnapshots) {
      return this.readTrackedFungibleAssetsWithBalances(context.address, trackedFungibleAssets);
    }

    return this.mergeDiscoveredWithTrackedAssets({
      address: context.address,
      assetRuleId: context.assetRuleId,
      network: context.network,
      trackedFungibleAssets,
      discoveredSnapshots,
    });
  }

  private async readTrackedFungibleAssetsWithBalances(address: Address, trackedFungibleAssets: Asset[]): Promise<IAsset[]> {
    return Promise.all(
      trackedFungibleAssets.map(async (asset) => {
        const balance = await this.fetchFungibleAssetBalance(address, asset);
        return this.toInterface(asset, balance);
      }),
    );
  }

  private async mergeDiscoveredWithTrackedAssets(params: {
    address: Address;
    assetRuleId: string;
    network: Network;
    trackedFungibleAssets: Asset[];
    discoveredSnapshots: DiscoveredFungibleAsset[];
  }): Promise<IAsset[]> {
    const trackedAssetsByKey = new Map<string, Asset>();
    for (const asset of params.trackedFungibleAssets) {
      trackedAssetsByKey.set(this.makeAssetLookupKey(this.mapAssetType(asset.type), asset.contractAddress), asset);
    }
    const metadataAssetsByKey = await this.readNetworkMetadataAssetsByKey(params.network, params.discoveredSnapshots, trackedAssetsByKey);

    const discoveredKeys = new Set<string>();
    const discoveredAssets = params.discoveredSnapshots.map((snapshot) => {
      const key = this.makeAssetLookupKey(snapshot.type, snapshot.contractAddress);
      const trackedAsset = trackedAssetsByKey.get(key) ?? null;
      const metadataAsset = trackedAsset ?? metadataAssetsByKey.get(key) ?? null;
      discoveredKeys.add(key);

      return this.toInterfaceFromDiscoverySnapshot({
        trackedAsset,
        metadataAsset,
        networkId: params.network.id,
        assetRuleId: params.assetRuleId,
        snapshot,
      });
    });

    const undiscoveredTrackedAssets = params.trackedFungibleAssets.filter(
      (asset) => !discoveredKeys.has(this.makeAssetLookupKey(this.mapAssetType(asset.type), asset.contractAddress)),
    );
    const supplementalAssets = await this.readTrackedFungibleAssetsWithBalances(params.address, undiscoveredTrackedAssets);

    return discoveredAssets.concat(supplementalAssets);
  }

  private async readNetworkMetadataAssetsByKey(
    network: Network,
    discoveredSnapshots: DiscoveredFungibleAsset[],
    trackedAssetsByKey: Map<string, Asset>,
  ): Promise<Map<string, Asset>> {
    const unresolvedContracts = Array.from(
      new Set(
        discoveredSnapshots
          .filter((snapshot) => snapshot.type === ASSET_TYPE.ERC20 && Boolean(snapshot.contractAddress))
          .filter((snapshot) => !trackedAssetsByKey.has(this.makeAssetLookupKey(snapshot.type, snapshot.contractAddress)))
          .map((snapshot) => snapshot.contractAddress as string),
      ),
    );

    if (unresolvedContracts.length === 0) {
      return new Map();
    }

    const metadataAssets = await Promise.all(unresolvedContracts.map((contractAddress) => network.queryAssetByAddress(contractAddress)));
    const metadataAssetsByKey = new Map<string, Asset>();

    for (const asset of metadataAssets) {
      if (!asset) {
        continue;
      }

      metadataAssetsByKey.set(this.makeAssetLookupKey(this.mapAssetType(asset.type), asset.contractAddress), asset);
    }

    return metadataAssetsByKey;
  }

  private async fetchFungibleAssetBalance(address: Address, asset: Asset): Promise<NormalizedBalance> {
    const network = await address.network.fetch();
    const provider = this.getChainProvider(network);
    const addressValue = await address.getValue();

    if (asset.type === DbAssetType.Native) {
      const raw = await provider.getBalance(addressValue);
      return this.parseHexBalance(raw, asset.decimals);
    }

    if (asset.type === DbAssetType.ERC20 && asset.contractAddress) {
      const hexAddress = this.resolveCalldataAddress(addressValue, network.networkType);
      const raw = await this.callERC20Method(provider, asset.contractAddress, 'balanceOf', [hexAddress]);
      return this.parseHexBalance(raw ?? '0x0', asset.decimals);
    }

    throw new Error(`Asset type ${asset.type} is not supported yet.`);
  }

  private async callERC20Method<T extends 'name' | 'symbol' | 'decimals' | 'balanceOf'>(
    provider: IChainProvider,
    contractAddress: string,
    method: T,
    args: unknown[],
  ): Promise<ERC20MethodReturnType<T> | null> {
    try {
      const data = iface777.encodeFunctionData(method, args) as Hex;
      const raw = await provider.call({ to: contractAddress, data });
      if (!raw || raw === '0x') return null;

      // Decode based on method type
      if (method === 'balanceOf') {
        return raw as ERC20MethodReturnType<T>;
      }

      const [value] = iface777.decodeFunctionResult(method, raw);

      if (method === 'decimals') {
        return (typeof value === 'number' ? value : Number(value)) as ERC20MethodReturnType<T>;
      }

      // name or symbol
      return (typeof value === 'string' ? value : null) as ERC20MethodReturnType<T>;
    } catch {
      return null;
    }
  }

  private resolveCalldataAddress(address: string, networkType: NetworkType): string {
    if (networkType === NetworkType.Conflux && (address.startsWith('cfx') || address.startsWith('net'))) {
      return convertBase32ToHex(address as Base32Address);
    }
    return address;
  }

  private parseHexBalance(rawHex: Hex, decimals: number | null | undefined): NormalizedBalance {
    const value = rawHex && rawHex !== '0x' ? BigInt(rawHex) : 0n;
    return this.buildBalanceFromBaseUnits(value.toString(), decimals);
  }

  private buildBalanceFromBaseUnits(baseUnits: string, decimals: number | null | undefined): NormalizedBalance {
    const resolvedDecimals = typeof decimals === 'number' ? decimals : 0;

    return {
      value: convertBalanceToDecimal(baseUnits, resolvedDecimals),
      formatted: balanceFormat(baseUnits, { decimals: resolvedDecimals, truncateLength: 4 }),
    };
  }

  private async resolveTokenMetadata(
    network: Network,
    contractAddress: string,
    fallback: { name?: string; symbol?: string; decimals?: number; icon?: string },
  ) {
    const provider = this.getChainProvider(network);

    const [name, symbol, decimals] = await Promise.all([
      this.callERC20Method(provider, contractAddress, 'name', []),
      this.callERC20Method(provider, contractAddress, 'symbol', []),
      this.callERC20Method(provider, contractAddress, 'decimals', []),
    ]);

    return {
      name: name ?? fallback.name,
      symbol: symbol ?? fallback.symbol,
      decimals: decimals ?? fallback.decimals ?? 18,
      icon: fallback.icon,
    };
  }

  private toInterface(asset: Asset, balance: NormalizedBalance): IAsset {
    return {
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      type: this.mapAssetType(asset.type),
      contractAddress: asset.contractAddress,
      decimals: asset.decimals,
      icon: asset.icon,
      source: this.mapAssetSource(asset.source),
      balance: balance.value,
      formattedBalance: balance.formatted,
      priceInUSDT: asset.priceInUSDT,
      priceValue: this.computePriceValue(balance.value, asset.priceInUSDT),
      networkId: asset.network.id,
      assetRuleId: asset.assetRule.id,
    };
  }

  private toInterfaceFromDiscoverySnapshot(params: {
    trackedAsset: Asset | null;
    metadataAsset: Asset | null;
    networkId: string;
    assetRuleId: string;
    snapshot: DiscoveredFungibleAsset;
  }): IAsset {
    const { trackedAsset, metadataAsset, networkId, assetRuleId, snapshot } = params;
    const metadata = trackedAsset ?? metadataAsset;
    const decimals = snapshot.decimals ?? metadata?.decimals ?? 18;
    const balance = this.buildBalanceFromBaseUnits(snapshot.balanceBaseUnits, decimals);
    const priceInUSDT = snapshot.priceInUSDT ?? metadata?.priceInUSDT ?? null;
    const icon =
      snapshot.type === ASSET_TYPE.Native ? (trackedAsset?.icon ?? snapshot.icon ?? metadata?.icon ?? null) : (snapshot.icon ?? metadata?.icon ?? null);

    return {
      id: trackedAsset?.id ?? this.makeDiscoveredAssetId(networkId, snapshot.type, snapshot.contractAddress),
      name: snapshot.name ?? metadata?.name ?? null,
      symbol: snapshot.symbol ?? metadata?.symbol ?? null,
      type: trackedAsset ? this.mapAssetType(trackedAsset.type) : snapshot.type,
      contractAddress: snapshot.contractAddress ?? metadata?.contractAddress ?? null,
      decimals,
      icon,
      source: metadata ? this.mapAssetSource(metadata.source) : ASSET_SOURCE.Official,
      balance: balance.value,
      formattedBalance: balance.formatted,
      priceInUSDT,
      priceValue: this.computePriceValue(balance.value, priceInUSDT),
      networkId,
      assetRuleId: trackedAsset?.assetRule.id ?? assetRuleId,
    };
  }

  private mapAssetType(type: DbAssetType): AssetTypeValue {
    return ASSET_TYPE_BY_DB_ASSET_TYPE[type];
  }

  private mapAssetSource(source: DbAssetSource | null): AssetSource | null {
    if (!source) return null;
    return ASSET_SOURCE_BY_DB_ASSET_SOURCE[source];
  }

  private computePriceValue(balance: string, priceInUSDT: string | null): string | null {
    if (!priceInUSDT) {
      return null;
    }
    try {
      return truncate(new Decimal(balance || 0).mul(priceInUSDT).toString(), 2);
    } catch {
      return null;
    }
  }

  private async discoverFungibleAssets(params: {
    address: {
      value: string;
      hex: string;
    };
    network: Network;
  }): Promise<DiscoveredFungibleAsset[] | null> {
    try {
      const provider = this.getChainProvider(params.network);
      return await this.assetDiscoveryRegistry.discoverFungibleAssets({
        address: params.address,
        network: {
          chainId: params.network.chainId,
          networkType: params.network.networkType,
        },
        chainProvider: provider,
      });
    } catch {
      return null;
    }
  }

  private orderFungibleAssets(assets: IAsset[]): IAsset[] {
    return assets.slice().sort((assetA, assetB) => {
      if (assetA.type === ASSET_TYPE.Native) return -1;
      if (assetB.type === ASSET_TYPE.Native) return 1;

      const sortableValueA = this.computeSortableValue(assetA);
      const sortableValueB = this.computeSortableValue(assetB);

      if (sortableValueA && sortableValueB) {
        if (!sortableValueA.equals(sortableValueB)) {
          return sortableValueA.lessThan(sortableValueB) ? 1 : -1;
        }
      } else if (sortableValueA) {
        return -1;
      } else if (sortableValueB) {
        return 1;
      }

      const labelA = (assetA.symbol ?? assetA.name ?? assetA.contractAddress ?? '').toUpperCase();
      const labelB = (assetB.symbol ?? assetB.name ?? assetB.contractAddress ?? '').toUpperCase();
      return labelA.localeCompare(labelB);
    });
  }

  private computeSortableValue(asset: IAsset): Decimal | null {
    if (!asset.priceInUSDT) {
      return null;
    }

    try {
      return new Decimal(asset.balance || 0).mul(asset.priceInUSDT);
    } catch {
      return null;
    }
  }

  private makeAssetLookupKey(type: AssetTypeValue, contractAddress: string | null): string {
    return type === ASSET_TYPE.Native ? NATIVE_ASSET_KEY : String(contractAddress ?? '').toLowerCase();
  }

  private makeDiscoveredAssetId(networkId: string, type: AssetTypeValue, contractAddress: string | null): string {
    return `discovered:${networkId}:${type}:${contractAddress ?? NATIVE_ASSET_KEY}`;
  }

  private async detectNftContractType(provider: IChainProvider, contractAddress: string): Promise<AssetTypeValue | null> {
    const supports = async (assetType: AssetTypeValue, interfaceId: string) => {
      try {
        const encoder = assetType === ASSET_TYPE.ERC721 ? iface721 : iface1155;
        const data = encoder.encodeFunctionData('supportsInterface', [interfaceId]) as Hex;
        const raw = await provider.call({ to: contractAddress, data });
        if (!raw || raw === '0x') return false;
        const [value] = encoder.decodeFunctionResult('supportsInterface', raw);
        return Boolean(value);
      } catch {
        return false;
      }
    };

    if (await supports(ASSET_TYPE.ERC721, ERC721_INTERFACE_ID)) return ASSET_TYPE.ERC721;
    if (await supports(ASSET_TYPE.ERC1155, ERC1155_INTERFACE_ID)) return ASSET_TYPE.ERC1155;
    return null;
  }
}

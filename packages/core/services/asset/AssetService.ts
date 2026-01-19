import { ChainRegistry } from '@core/chains';
import { iface777 } from '@core/contracts';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import { type Asset, AssetSource } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { AssetType, type Hex, type IChainProvider } from '@core/types';
import { type Base32Address, convertBase32ToHex } from '@core/utils/address';
import { balanceFormat, convertBalanceToDecimal } from '@core/utils/balance';
import { NetworkType } from '@core/utils/consts';
import Decimal from 'decimal.js';
import { inject, injectable } from 'inversify';
import type { AddCustomTokenInput, IAsset } from './types';

type NormalizedBalance = {
  value: string;
  formatted: string;
};

type ERC20MethodReturnType<T extends string> = T extends 'name' | 'symbol' ? string : T extends 'decimals' ? number : T extends 'balanceOf' ? Hex : never;

@injectable()
export class AssetService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  async getAssetsByAddress(addressId: string): Promise<IAsset[]> {
    const address = await this.findAddress(addressId);
    const assetRule = await address.assetRule.fetch();
    const assets = await assetRule.assets.fetch();

    return Promise.all(
      assets.map(async (asset) => {
        const balance = await this.fetchAssetBalance(address, asset);
        return this.toInterface(asset, balance);
      }),
    );
  }

  async getAssetBalance(addressId: string, assetId: string): Promise<string> {
    const address = await this.findAddress(addressId);
    const asset = await this.findAsset(assetId);
    const balance = await this.fetchAssetBalance(address, asset);
    return balance.value;
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
        record.type = AssetType.ERC20;
        record.contractAddress = input.contractAddress;
        record.name = metadata.name ?? null;
        record.symbol = metadata.symbol ?? null;
        record.decimals = metadata.decimals ?? 18;
        record.icon = metadata.icon ?? null;
        record.source = AssetSource.Custom;
        record.priceInUSDT = null;
      });
    });

    const balance = await this.fetchAssetBalance(address, asset);
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
      throw new Error(`Chain ${network.networkType} (${network.chainId}) is not registered.`);
    }
    return provider;
  }

  private async fetchAssetBalance(address: Address, asset: Asset): Promise<NormalizedBalance> {
    const network = await address.network.fetch();
    const provider = this.getChainProvider(network);
    const addressValue = await address.getValue();

    if (asset.type === AssetType.Native) {
      const raw = await provider.getBalance(addressValue);
      return this.normalizeBalance(raw, asset.decimals);
    }

    if (asset.type === AssetType.ERC20 && asset.contractAddress) {
      const hexAddress = this.normalizeAccountForCalldata(addressValue, network.networkType);
      const raw = await this.callERC20Method(provider, asset.contractAddress, 'balanceOf', [hexAddress]);
      return this.normalizeBalance(raw ?? '0x0', asset.decimals);
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

  private normalizeAccountForCalldata(address: string, networkType: NetworkType): string {
    if (networkType === NetworkType.Conflux && (address.startsWith('cfx') || address.startsWith('net'))) {
      return convertBase32ToHex(address as Base32Address);
    }
    return address;
  }

  private normalizeBalance(rawHex: Hex, decimals: number | null | undefined): NormalizedBalance {
    const value = rawHex && rawHex !== '0x' ? BigInt(rawHex) : 0n;
    const baseUnits = value.toString();
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
      type: asset.type,
      contractAddress: asset.contractAddress,
      decimals: asset.decimals,
      icon: asset.icon,
      source: asset.source,
      balance: balance.value,
      formattedBalance: balance.formatted,
      priceInUSDT: asset.priceInUSDT,
      priceValue: this.computePriceValue(balance.value, asset.priceInUSDT),
      networkId: asset.network.id,
      assetRuleId: asset.assetRule.id,
    };
  }

  private computePriceValue(balance: string, priceInUSDT: string | null): string | null {
    if (!priceInUSDT) {
      return null;
    }
    try {
      return new Decimal(balance || 0).mul(priceInUSDT).toString();
    } catch {
      return null;
    }
  }
}

import { ChainRegistry } from '@core/chains';
import { iface721 } from '@core/contracts';
import type { Database } from '@core/database';
import type { Address as DbAddress } from '@core/database/models/Address';
import { type Asset, AssetSource, AssetType as DbAssetType } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CHAIN_PROVIDER_NOT_FOUND, CoreError } from '@core/errors';
import type { RuntimeConfig } from '@core/runtime/types';
import { ASSET_TYPE, type Hex, type IChainProvider } from '@core/types';
import { convertToChecksum, isHexAddress } from '@core/utils/account';
import { NetworkType } from '@core/utils/consts';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import { buildScanOpenApiKey, type NftSyncItemDetail } from '../../modules/nftSync';
import { fetchNftItemsFromConfluxScanEvmOpenApi } from '../../modules/nftSync/fetchers/confluxScanEvmOpenApi';
import type { INftCollection, INftItem, NftCollectionType } from './types';

type ScanTokenListItem = {
  type: string;
  contract: string;
  iconUrl?: string;
};

type ScanTokenListResponse = {
  status: '0' | '1';
  message: string;
  result?: { list?: ScanTokenListItem[] };
};

const isParameterWrongMessage = (message: string): boolean => message.includes('The parameter is wrong, please confirm it is correct');

@injectable()
export class NftService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  @inject(CORE_IDENTIFIERS.CONFIG)
  @optional()
  private readonly config?: RuntimeConfig;

  async listCollections(params: { addressId: string; signal?: AbortSignal }): Promise<INftCollection[]> {
    const address = await this.findAddress(params.addressId);
    const network = await address.network.fetch();

    // Only EVM networks are supported for now.
    if (network.networkType !== NetworkType.Ethereum) {
      return this.listCollectionsFromDb(address);
    }

    const baseUrl = this.getScanOpenApiBaseUrl(network);
    if (!baseUrl) {
      return this.listCollectionsFromDb(address);
    }

    try {
      const ownerHex = address.hex;
      const remote = await this.fetchCollectionsFromScan({
        baseUrl,
        ownerHex,
        signal: params.signal,
      });

      await this.upsertCollectionsFromScan(address, network, remote, params.signal);

      // Return a stable list based on the remote contracts, falling back to db metadata.
      const byContract = new Map((await this.listCollectionsFromDb(address)).map((c) => [c.contractAddress.toLowerCase(), c]));
      return remote.map((r) => byContract.get(r.contractAddress.toLowerCase())).filter((v): v is INftCollection => Boolean(v));
    } catch {
      return this.listCollectionsFromDb(address);
    }
  }

  async getItems(params: { addressId: string; contractAddress: string; signal?: AbortSignal }): Promise<INftItem[]> {
    const address = await this.findAddress(params.addressId);
    const network = await address.network.fetch();

    if (network.networkType !== NetworkType.Ethereum) {
      return [];
    }

    const baseUrl = this.getScanOpenApiBaseUrl(network);
    if (!baseUrl) {
      return [];
    }

    const ownerHex = address.hex;
    const contractAddress = this.normalizeContractAddress(params.contractAddress);
    if (!contractAddress) return [];

    const items = await fetchNftItemsFromConfluxScanEvmOpenApi({
      baseUrl,
      ownerAddress: ownerHex,
      contractAddress,
      signal: params.signal,
    });

    return items.map(this.toItemInterface);
  }

  private async listCollectionsFromDb(address: DbAddress): Promise<INftCollection[]> {
    const assetRule = await address.assetRule.fetch();
    const assets = await assetRule.assets.extend(Q.where('type', Q.oneOf([DbAssetType.ERC721, DbAssetType.ERC1155]))).fetch();

    return assets.map((asset) => this.toCollectionInterface(asset));
  }

  private normalizeContractAddress(contractAddress: string): string | null {
    const trimmed = contractAddress.trim();
    if (!trimmed) return null;
    return isHexAddress(trimmed) ? convertToChecksum(trimmed) : trimmed;
  }

  private getScanOpenApiBaseUrl(network: Pick<Network, 'networkType' | 'chainId'>): string | null {
    const cfg = this.config?.sync?.nft?.scanOpenApiByKey ?? {};
    const key = buildScanOpenApiKey({ networkType: network.networkType, chainId: network.chainId });
    const url = cfg[key];
    return typeof url === 'string' && url ? url : null;
  }

  private async fetchCollectionsFromScan(params: {
    baseUrl: string;
    ownerHex: string;
    signal?: AbortSignal;
  }): Promise<Array<{ contractAddress: string; type: NftCollectionType; iconUrl?: string }>> {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
      throw new Error('fetch is not available');
    }

    const fetchOnce = async (tokenType: NftCollectionType) => {
      const url = new URL('/account/tokens', params.baseUrl);
      url.searchParams.set('account', params.ownerHex);
      url.searchParams.set('tokenType', tokenType);

      const res = await fetchFn(url, { method: 'GET', signal: params.signal });
      if (!res.ok) {
        throw new Error(`Scan OpenAPI HTTP error: ${res.status}`);
      }

      const json = (await res.json()) as ScanTokenListResponse;
      if (json?.status !== '1') {
        if (isParameterWrongMessage(String(json?.message ?? ''))) {
          return [] as ScanTokenListItem[];
        }
        throw new Error(String(json?.message ?? 'Scan OpenAPI error'));
      }

      return Array.isArray(json?.result?.list) ? json.result!.list! : [];
    };

    const [erc721List, erc1155List] = await Promise.all([fetchOnce(ASSET_TYPE.ERC721), fetchOnce(ASSET_TYPE.ERC1155)]);

    const normalized = [
      ...erc721List.map((item) => ({ ...item, type: ASSET_TYPE.ERC721 })),
      ...erc1155List.map((item) => ({ ...item, type: ASSET_TYPE.ERC1155 })),
    ]
      .map((item) => {
        const contract = this.normalizeContractAddress(String(item?.contract ?? ''));
        if (!contract) return null;

        const rawType = String(item?.type ?? '');
        const type = rawType === ASSET_TYPE.ERC721 ? ASSET_TYPE.ERC721 : rawType === ASSET_TYPE.ERC1155 ? ASSET_TYPE.ERC1155 : null;
        if (!type) return null;

        return { contractAddress: contract, type, iconUrl: item?.iconUrl };
      })
      .filter((v): v is { contractAddress: string; type: NftCollectionType; iconUrl: string | undefined } => Boolean(v));

    // Dedupe by contract.
    const deduped = new Map<string, { contractAddress: string; type: NftCollectionType; iconUrl: string | undefined }>();
    for (const item of normalized) {
      deduped.set(item.contractAddress.toLowerCase(), item);
    }
    return Array.from(deduped.values());
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

  private async readNftContractMetadata(params: {
    chainProvider: IChainProvider;
    contractAddress: string;
  }): Promise<{ name: string | null; symbol: string | null }> {
    const { chainProvider, contractAddress } = params;

    const callString = async (method: 'name' | 'symbol'): Promise<string | null> => {
      try {
        const data = iface721.encodeFunctionData(method, []) as Hex;
        const raw = await chainProvider.call({ to: contractAddress, data });
        if (!raw || raw === '0x') return null;
        const [value] = iface721.decodeFunctionResult(method, raw);
        return typeof value === 'string' ? value : null;
      } catch {
        return null;
      }
    };

    const [name, symbol] = await Promise.all([callString('name'), callString('symbol')]);
    return { name, symbol };
  }

  private async upsertCollectionsFromScan(
    address: DbAddress,
    network: Network,
    remote: Array<{ contractAddress: string; type: NftCollectionType; iconUrl?: string }>,
    _signal?: AbortSignal,
  ): Promise<void> {
    if (!remote.length) return;

    const assetRule = await address.assetRule.fetch();
    const existing = await assetRule.assets.extend(Q.where('type', Q.oneOf([DbAssetType.ERC721, DbAssetType.ERC1155]))).fetch();

    const existingByContract = new Map(existing.map((a) => [(a.contractAddress ?? '').toLowerCase(), a]));
    const chainProvider = this.getChainProvider(network);

    const toCreate: Asset[] = [];
    const toUpdate: Asset[] = [];

    for (const item of remote) {
      const contractLower = item.contractAddress.toLowerCase();
      const found = existingByContract.get(contractLower);

      if (found) {
        const nextIcon = item.iconUrl ?? null;
        if (nextIcon && found.icon !== nextIcon) {
          toUpdate.push(
            found.prepareUpdate((record) => {
              record.icon = nextIcon;
            }),
          );
        }
        continue;
      }

      const metadata = await this.readNftContractMetadata({ chainProvider, contractAddress: item.contractAddress });

      toCreate.push(
        this.database.get<Asset>(TableName.Asset).prepareCreate((record) => {
          record.assetRule.set(assetRule);
          record.network.set(network);
          record.type = item.type === ASSET_TYPE.ERC721 ? DbAssetType.ERC721 : DbAssetType.ERC1155;
          record.contractAddress = item.contractAddress;
          record.name = metadata.name;
          record.symbol = metadata.symbol;
          record.decimals = 0;
          record.icon = item.iconUrl ?? null;
          record.source = AssetSource.Official;
          record.priceInUSDT = null;
        }),
      );
    }

    if (toCreate.length === 0 && toUpdate.length === 0) return;

    await this.database.write(async () => {
      await this.database.batch(...toUpdate, ...toCreate);
    });
  }

  private async findAddress(addressId: string): Promise<DbAddress> {
    try {
      return await this.database.get<DbAddress>(TableName.Address).find(addressId);
    } catch {
      throw new Error(`[NftService] Address ${addressId} not found in database.`);
    }
  }

  private toCollectionInterface(asset: Asset): INftCollection {
    return {
      id: asset.id,
      networkId: asset.network.id,
      contractAddress: (asset.contractAddress ?? '') as INftCollection['contractAddress'],
      type: asset.type === DbAssetType.ERC721 ? ASSET_TYPE.ERC721 : ASSET_TYPE.ERC1155,
      name: asset.name,
      symbol: asset.symbol,
      icon: asset.icon,
    };
  }

  private toItemInterface = (item: NftSyncItemDetail): INftItem => {
    return {
      name: item.name,
      description: item.description ?? null,
      icon: item.icon ?? null,
      amount: item.amount,
      tokenId: item.tokenId,
    };
  };
}

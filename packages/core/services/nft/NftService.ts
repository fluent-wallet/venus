import type { Database } from '@core/database';
import type { Address as DbAddress } from '@core/database/models/Address';
import { type Asset, AssetSource, AssetType as DbAssetType } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeConfig } from '@core/runtime/types';
import { ASSET_TYPE } from '@core/types';
import { convertToChecksum } from '@core/utils/account';
import { NetworkType } from '@core/utils/consts';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import { buildScanOpenApiKey, fetchNftItemsPageFromConfluxScan, fetchScanPage, NFT_COLLECTIONS_PAGE_SIZE } from './confluxScan';
import type { INftCollection, INftItemsPage, NftCollectionType } from './types';

type ScanNftCollection = {
  contract: string;
  type: NftCollectionType;
  name?: string;
  symbol?: string;
  iconUrl?: string;
};

@injectable()
export class NftService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(CORE_IDENTIFIERS.CONFIG)
  @optional()
  private readonly config?: RuntimeConfig;

  async listCollections(params: { addressId: string }): Promise<INftCollection[]> {
    const address = await this.database.get<DbAddress>(TableName.Address).find(params.addressId);
    const network = await address.network.fetch();

    const baseUrl = this.getScanOpenApiBaseUrl(network);
    if (!baseUrl) return [];

    const remoteCollections = await this.fetchCollectionsFromScan({ baseUrl, ownerHex: address.hex });
    if (!remoteCollections.length) return [];

    const remoteByContract = new Map(remoteCollections.map((collection) => [collection.contract.toLowerCase(), collection]));
    const assetRule = await address.assetRule.fetch();

    return this.database.write(async () => {
      const storedCollections = await assetRule.assets.extend(Q.where('type', Q.oneOf([DbAssetType.ERC721, DbAssetType.ERC1155]))).fetch();
      const storedByContract = new Map(storedCollections.map((collection) => [collection.contractAddress?.toLowerCase(), collection]));
      const changes: Asset[] = [];

      for (const [contract, collection] of remoteByContract) {
        const existingCollection = storedByContract.get(contract);
        const name = collection.name ?? existingCollection?.name ?? null;
        const symbol = collection.symbol ?? existingCollection?.symbol ?? null;
        const icon = collection.iconUrl ?? existingCollection?.icon ?? null;

        if (existingCollection) {
          if (existingCollection.name !== name || existingCollection.symbol !== symbol || existingCollection.icon !== icon) {
            changes.push(
              existingCollection.prepareUpdate((record) => {
                record.name = name;
                record.symbol = symbol;
                record.icon = icon;
              }),
            );
          }

          continue;
        }

        const newCollection = this.database.get<Asset>(TableName.Asset).prepareCreate((record) => {
          record.assetRule.set(assetRule);
          record.network.set(network);
          record.type = collection.type === ASSET_TYPE.ERC721 ? DbAssetType.ERC721 : DbAssetType.ERC1155;
          record.contractAddress = convertToChecksum(collection.contract);

          record.name = name;
          record.symbol = symbol;
          record.decimals = 0;
          record.icon = icon;
          record.source = AssetSource.Official;
          record.priceInUSDT = null;
        });

        storedCollections.push(newCollection);
        changes.push(newCollection);
      }

      if (changes.length) await this.database.batch(...changes);

      // Preserve catalog order, but only return collections held by this address.
      return storedCollections
        .filter((collection) => remoteByContract.has(collection.contractAddress?.toLowerCase() ?? ''))
        .map((collection) => this.toCollectionInterface(collection));
    });
  }

  async getItemsPage(params: { addressId: string; contractAddress: string; cursor: string }): Promise<INftItemsPage> {
    const address = await this.database.get<DbAddress>(TableName.Address).find(params.addressId);
    const network = await address.network.fetch();
    const baseUrl = this.getScanOpenApiBaseUrl(network);
    if (!baseUrl) return { items: [], nextCursor: null };

    const page = await fetchNftItemsPageFromConfluxScan({
      baseUrl,
      ownerAddress: address.hex,
      contractAddress: params.contractAddress,
      cursor: params.cursor,
    });
    return {
      items: page.list.map((item) => ({
        tokenId: item.tokenId,
        name: item.name ?? '',
        description: item.description ?? null,
        icon: item.image ?? null,
        amount: item.amount,
      })),
      nextCursor: page.nextCursor,
    };
  }

  private getScanOpenApiBaseUrl(network: Pick<Network, 'networkType' | 'chainId'>): string | null {
    if (network.networkType !== NetworkType.Ethereum) return null;
    return this.config?.nft?.scanOpenApiByKey?.[buildScanOpenApiKey(network)] ?? null;
  }

  private async fetchCollectionsFromScan(params: { baseUrl: string; ownerHex: string }): Promise<ScanNftCollection[]> {
    const fetchByType = async (tokenType: NftCollectionType) => {
      const collections: ScanNftCollection[] = [];
      for (let skip = 0; ; skip += NFT_COLLECTIONS_PAGE_SIZE) {
        const url = new URL('/account/tokens', params.baseUrl);
        url.searchParams.set('account', params.ownerHex);
        url.searchParams.set('tokenType', tokenType);
        url.searchParams.set('skip', String(skip));
        url.searchParams.set('limit', String(NFT_COLLECTIONS_PAGE_SIZE));
        const page = await fetchScanPage<ScanNftCollection>(url);
        collections.push(...page.list);
        if (skip + page.list.length >= page.total || page.list.length < NFT_COLLECTIONS_PAGE_SIZE) return collections;
      }
    };

    const lists = await Promise.all([fetchByType(ASSET_TYPE.ERC721), fetchByType(ASSET_TYPE.ERC1155)]);
    return lists.flat();
  }

  private toCollectionInterface(asset: Asset): INftCollection {
    return {
      id: asset.id,
      networkId: asset.network.id,
      contractAddress: asset.contractAddress as string,
      type: asset.type === DbAssetType.ERC721 ? ASSET_TYPE.ERC721 : ASSET_TYPE.ERC1155,
      name: asset.name,
      symbol: asset.symbol,
      icon: asset.icon,
    };
  }
}

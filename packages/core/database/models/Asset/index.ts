import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, field, immutableRelation, text, writer } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';
import type { AssetRule } from '../AssetRule';
import type { Network } from '../Network';
import type { Tx } from '../Tx';

export enum AssetSource {
  Custom = 'Custom',
  Official = 'Official',
}

export enum AssetType {
  Native = 'Native',
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
}

export class Asset extends Model {
  static table = TableName.Asset;
  static associations = {
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.AssetRule]: { type: 'belongs_to', key: 'asset_rule_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'asset_id' },
  } as const;

  @text('contract_address') contractAddress!: string | null;
  @text('type') type!: AssetType;
  @text('name') name!: string | null;
  @text('symbol') symbol!: string | null;
  @field('decimals') decimals!: number | null;
  @text('icon') icon!: string | null;
  @text('price_in_usdt') priceInUSDT!: string | null;
  @text('source') source!: AssetSource | null;
  @children(TableName.Tx) txs!: Query<Tx>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
  @immutableRelation(TableName.AssetRule, 'asset_rule_id') assetRule!: Relation<AssetRule>;

  @writer async updateSelft({ icon, priceInUSDT }: { icon?: string; priceInUSDT?: string }) {
    if (!icon && !priceInUSDT) return;
    await this.update((asset) => {
      if (icon) {
        asset.icon = icon;
      }
      if (priceInUSDT) {
        asset.priceInUSDT = priceInUSDT;
      }
    });
  }

  prepareUpdateSelft({ icon, priceInUSDT }: { icon?: string; priceInUSDT?: string }) {
    return this.prepareUpdate((asset) => {
      if (icon) {
        asset.icon = icon;
      }
      if (priceInUSDT) {
        asset.priceInUSDT = priceInUSDT;
      }
    });
  }

  get hashKey() {
    return this.contractAddress || this.type;
  }
}

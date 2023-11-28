import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type Network } from '../Network';
import { type AssetRule } from '../AssetRule';
import { type Tx } from '../Tx';
import TableName from '../../TableName';

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

  @text('asset_address') assetAddress!: string;
  @text('type') type!: AssetType;
  @text('name') name!: string | null;
  @text('symbol') symbol!: string | null;
  @field('decimals') decimals!: number | null;
  @text('icon') icon!: string | null;
  @text('asset_id') assetId!: string | null;
  @children(TableName.Tx) txs!: Query<Tx>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
  @immutableRelation(TableName.AssetRule, 'asset_rule_id') assetRule!: Relation<AssetRule>;
}

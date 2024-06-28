import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, field, immutableRelation, text } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';
import type { Address } from '../Address';
import type { Asset } from '../Asset';
import type { Network } from '../Network';

export class AssetRule extends Model {
  static table = TableName.AssetRule;
  static associations = {
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Address]: { type: 'has_many', foreignKey: 'asset_rule_id' },
    [TableName.Asset]: { type: 'has_many', foreignKey: 'asset_rule_id' },
  } as const;

  @text('name') name!: string;
  /** Display order in the assetRule list. 0 means that this Rule is the default Rule for only one Native Asset and cannot be deleted. */
  @field('index') index!: number;
  @children(TableName.Asset) assets!: Query<Asset>;
  @children(TableName.Address) addresses!: Query<Address>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
}

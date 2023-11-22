import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type Network } from '../Network';
import { type Address } from '../Address';
import { type Asset } from '../Asset';
import TableName from '../../TableName';

export class AssetRule extends Model {
  static table = TableName.AssetRule;
  static associations = {
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Address]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.Asset]: { type: 'has_many', foreignKey: 'asset_id' },
  } as const;

  @text('name') name!: string;
  /** Display order in the assetRule list. -1 means do not show. */
  @field('index') index!: number;
  @children(TableName.Asset) assets!: Query<Asset>;
  @children(TableName.Address) addresses!: Query<Address>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
}

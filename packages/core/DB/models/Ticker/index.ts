import { Model, type Query } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';
import { type Network } from '../Network';
import TableName from '../../TableName';

export class Ticker extends Model {
  static table = TableName.Ticker;
  static associations = {
    [TableName.Network]: { type: 'has_many', foreignKey: 'ticker_id' },
  } as const;

  @text('name') name!: string;
  @text('symbol') symbol!: string;
  @field('decimals') decimals!: number;
  @text('icon_urls') iconUrls!: string | null;
  @children(TableName.Network) network!: Query<Network>;
}
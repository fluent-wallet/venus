import { Model, type Query } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import TableName from '../../TableName';

export class TxExtra extends Model {
  static table = TableName.TxExtra;
  static associations = {
    [TableName.Tx]: { type: 'has_many', foreignKey: 'asset_id' },
  } as const;

  @field('ok') ok!: boolean | null;
  @field('contract_creation') contractCreation!: boolean | null;
  @field('simple') simple!: boolean;
  @text('send_action') sendAction!: string;
  @field('contract_interaction') contractInteraction!: boolean | null;
  @field('token20') token20!: boolean | null;
  @field('token_nft') tokenNft!: boolean;
  @text('address') address!: string;
  @text('method') method!: string | null;
  @children(TableName.Tx) txs!: Query<Tx>;
}

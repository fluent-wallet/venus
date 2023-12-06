import { Model, type Query } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import TableName from '../../TableName';

export class TxExtra extends Model {
  static table = TableName.TxExtra;
  static associations = {
    [TableName.Tx]: { type: 'has_many', foreignKey: 'tx_extra_id' },
  } as const;

  @field('ok') ok!: boolean | null; // extra data is finished
  @field('contract_creation') contractCreation!: boolean | null; // contract creation tx
  @field('simple') simple!: boolean; // simple tx
  @text('send_action') sendAction!: string; // speedup or cancel
  @field('contract_interaction') contractInteraction!: boolean | null; // contract interaction tx
  @field('token20') token20!: boolean | null; // 20 contract
  @field('token_nft') tokenNft!: boolean; // nft contract
  @text('address') address!: string; // intresting address of this tx, usually recipient
  @text('method') method!: string | null; // contract call method name
  @children(TableName.Tx) txs!: Query<Tx>;
}

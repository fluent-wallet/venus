import { of } from 'rxjs';
import { Model, type Relation } from '@nozbe/watermelondb';
import { text, readonly, date, immutableRelation, reader, writer } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type App } from '../App';
import { type Tx } from '../Tx';
import TableName from '../../TableName';
import { SignType } from './type';

export class Signature extends Model {
  static table = TableName.Signature;
  static associations = {
    [TableName.App]: { type: 'belongs_to', key: 'app_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.Tx]: { type: 'belongs_to', key: 'tx_id' },
  } as const;

  @text('sign_type') signType!: SignType;
  @text('message') message?: string | null;
  /** current blockNumber when sign, only for sort */
  @text('block_number') blockNumber!: string;
  @readonly @date('created_at') createdAt!: Date;
  @immutableRelation(TableName.App, 'app_id') app!: Relation<App>;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
  /** optional, Relation<Tx | null> */
  @immutableRelation(TableName.Tx, 'tx_id') tx!: Relation<Tx>;

  @writer updateTx(tx: Tx) {
    return this.update((s) => s.tx.set(tx));
  }

  @reader async getTx() {
    if (!this.tx.id) return null;
    const tx = await this.tx;
    return tx;
  }
  observeTx() {
    if (!this.tx.id) return of(null);
    return this.tx.observe();
  }
}

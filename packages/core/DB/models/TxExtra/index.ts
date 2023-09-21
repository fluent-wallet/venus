import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import { TableName } from '../../index';

export class TxExtra extends Model {
  static table = TableName.TxExtra;

  @field('ok') ok!: boolean | null;
  @field('contract_creation') contractCreation!: boolean | null;
  @field('simple') simple!: boolean;
  @text('send_action') sendAction!: string;
  @field('contract_interaction') contractInteraction!: boolean | null;
  @field('token20') token20!: boolean | null;
  @field('token_nft') tokenNft!: boolean;
  @text('address') address!: string;
  @text('method') method!: string | null;
}

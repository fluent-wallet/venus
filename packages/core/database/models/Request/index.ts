import { Model, type Relation } from '@nozbe/watermelondb';
import { text, field, readonly, date, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type App } from '../App';
import TableName from '../../TableName';

export class Request extends Model {
  static table = TableName.Request;
  static associations = {
    [TableName.App]: { type: 'belongs_to', key: 'app_id' },
  } as const;

  @readonly @text('type') type!: string;
  @field('processed') processed!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @immutableRelation(TableName.App, 'app_id') app!: Relation<App>;
}

import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';

export class Site extends Model {
  static table = TableName.Site;
  static associations = {
    [TableName.App]: { type: 'has_many', foreignKey: 'site_id' },
  } as const;

  @text('origin') origin!: string;
  @text('name') name?: string;
  @text('icon') icon?: string;
}

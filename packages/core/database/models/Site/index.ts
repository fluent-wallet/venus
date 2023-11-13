import { Model } from '@nozbe/watermelondb';
import { text, readonly } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';

export class Site extends Model {
  static table = TableName.Site;

  @readonly @text('origin') origin!: string;
  @text('name') name?: string;
  @text('icon') icon?: string;
}

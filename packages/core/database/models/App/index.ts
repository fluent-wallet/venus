import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { text, readonly, date, immutableRelation, children } from '@nozbe/watermelondb/decorators';
import { type Permission } from '../Permission';
import { type Site } from '../Site';
import TableName from '../../TableName';

export class App extends Model {
  static table = TableName.App;
  static associations = {
    [TableName.Site]: { type: 'belongs_to', key: 'site_id' },
    [TableName.Permission]: { type: 'has_many', foreignKey: 'permission_id' },
  } as const;

  @text('name') name!: string;
  @text('icon') icon?: string;
  @readonly @date('updated_at') updatedAt!: Date;
  @readonly @immutableRelation(TableName.Site, 'site_id') site!: Relation<Site>;
  @children(TableName.Permission) permissions!: Query<Permission>;
}

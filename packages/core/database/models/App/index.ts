import { Model, type Query } from '@nozbe/watermelondb';
import { text, children } from '@nozbe/watermelondb/decorators';
import { type Permission } from '../Permission';
import TableName from '../../TableName';
import { Signature } from '../Signature';

export class App extends Model {
  static table = TableName.App;
  static associations = {
    [TableName.Permission]: { type: 'has_many', foreignKey: 'app_id' },
    [TableName.Signature]: { type: 'has_many', foreignKey: 'app_id' },
  } as const;

  @text('identity') identity!: string;
  @text('origin') origin?: string;
  @text('name') name!: string;
  @text('icon') icon?: string;
  @children(TableName.Permission) permissions!: Query<Permission>;
  @children(TableName.Signature) signatures!: Query<Signature>;
}

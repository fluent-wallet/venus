import { Model, type Relation } from '@nozbe/watermelondb';
import { text, readonly, date, writer, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type App } from '../App';
import TableName from '../../TableName';
import { RequestStatus, RequestType } from './RequestType';

export class Request extends Model {
  static table = TableName.Request;
  static associations = {
    [TableName.App]: { type: 'belongs_to', key: 'app_id' },
  } as const;

  @text('type') type!: RequestType;
  @text('value') value!: string | null;
  @text('status') status!: RequestStatus;
  @readonly @date('created_at') createdAt!: Date;
  @immutableRelation(TableName.App, 'app_id') app!: Relation<App>;

  @writer async updateStatus(newStatus: RequestStatus) {
    if (this.status === newStatus) return;
    await this.update((request) => {
      request.status = newStatus;
    });
  }

  prepareUpdateStatus(newStatus: RequestStatus) {
    return this.prepareUpdate((request) => {
      request.status = newStatus;
    });
  }
}

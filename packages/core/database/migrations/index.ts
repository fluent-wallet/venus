import { createTable, schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';
import TableName from '../TableName';

const migrations = schemaMigrations({
  migrations: [],
});

export default migrations;

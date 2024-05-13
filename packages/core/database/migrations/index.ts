import { createTable, schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';
import TableName from '../TableName';

const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: TableName.Tx,
          columns: [
            { name: 'error_type', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});

export default migrations;

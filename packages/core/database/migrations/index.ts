import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import TableName from '../TableName';

const migrations = schemaMigrations({
  migrations: [
    {
      // ⚠️ Set this to a number one larger than the current schema version
      toVersion: 2,
      steps: [
        // See "Migrations API" for more details
        addColumns({
          table: TableName.Tx,
          columns: [
            { name: 'executed_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});

export default migrations;

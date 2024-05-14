import { createTable, schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';
import TableName from '../TableName';

const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: TableName.Tx,
          columns: [{ name: 'error_type', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: TableName.Signature,
          columns: [
            { name: 'app_id', type: 'string', isIndexed: true, isOptional: true },
            { name: 'address_id', type: 'string', isIndexed: true },
            { name: 'tx_id', type: 'string', isIndexed: true, isOptional: true },
            { name: 'sign_type', type: 'string' },
            { name: 'message', type: 'string', isOptional: true },
            { name: 'block_number', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
});

export default migrations;

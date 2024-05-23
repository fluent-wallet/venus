import { createTable, schemaMigrations, addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';
import TableName from '../TableName';
import { TxSource, ExecutedStatus, TxStatus } from '../models/Tx/type';
import { ProcessErrorType } from '@core/utils/eth';

const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
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
        addColumns({
          table: TableName.Tx,
          columns: [
            { name: 'source', type: 'string' },
            { name: 'method', type: 'string' },
            { name: 'error_type', type: 'string', isOptional: true },
            { name: 'signature_id', type: 'string', isIndexed: true, isOptional: true },
          ],
        }),
        unsafeExecuteSql(
          `
          UPDATE ${TableName.Tx} SET source = '${TxSource.SELF}' WHERE is_local = true;
          UPDATE ${TableName.Tx} SET method = 'Send' WHERE is_local = true;
          UPDATE ${TableName.Tx} SET error_type = '${ProcessErrorType.executeFailed}' WHERE executed_status = '${ExecutedStatus.FAILED}';
          UPDATE ${TableName.Tx} SET error_type = '${ProcessErrorType.replacedByAnotherTx}' WHERE status = '${TxStatus.REPLACED}';
          `,
        ),
      ],
    },
  ],
});

export default migrations;

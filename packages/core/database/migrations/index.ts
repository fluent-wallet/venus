import { schemaMigrations, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';
import TableName from '../TableName';
import { TxStatus } from '../models/Tx/type';

const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        unsafeExecuteSql(
          `
          UPDATE ${TableName.Tx} SET status = '${TxStatus.REPLACED}' WHERE status = '-2';
          UPDATE ${TableName.Tx} SET status = '${TxStatus.SEND_FAILED}' WHERE status = '-1';
          UPDATE ${TableName.Tx} SET status = '${TxStatus.WAITTING}' WHERE status = '0';
          UPDATE ${TableName.Tx} SET status = '${TxStatus.PENDING}' WHERE status = '1';
          UPDATE ${TableName.Tx} SET status = '${TxStatus.EXECUTED}' WHERE status = '2';
          UPDATE ${TableName.Tx} SET status = '${TxStatus.CONFIRMED}' WHERE status = '3';
          UPDATE ${TableName.Tx} SET status = '${TxStatus.FINALIZED}' WHERE status = '4';
          `,
        ),
      ],
    },
    {
      toVersion: 3,
      steps: [
        unsafeExecuteSql(
          `UPDATE ${TableName.Network} SET scan_url = REPLACE(scan_url, 'confluxscan.io', 'confluxscan.org') WHERE scan_url LIKE '%confluxscan.io%';`,
        )
      ],
    },
  ],
});

export default migrations;

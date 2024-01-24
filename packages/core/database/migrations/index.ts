import { createTable, schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';
import TableName from '../TableName';

const migrations = schemaMigrations({
  migrations: [
    {
      // ⚠️ Set this to a number one larger than the current schema version
      toVersion: 2,
      steps: [
        // See "Migrations API" for more details
        createTable({
          name: TableName.Tx,
          columns: [
            { name: 'raw', type: 'string', isOptional: true },
            { name: 'hash', type: 'string' },
            { name: 'status', type: 'string' },
            { name: 'executed_status', type: 'string', isOptional: true },
            { name: 'receipt', type: 'string', isOptional: true },
            { name: 'confirmed_number', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'executed_at', type: 'number', isOptional: true },
            { name: 'err', type: 'string', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'send_at', type: 'number', isOptional: true },
            { name: 'resend_at', type: 'number', isOptional: true },
            { name: 'resend_count', type: 'number', isOptional: true },
            { name: 'polling_count', type: 'number', isOptional: true },
            { name: 'is_temp_replaced', type: 'boolean', isOptional: true },
            { name: 'app_id', type: 'string', isIndexed: true, isOptional: true },
            { name: 'asset_id', type: 'string', isIndexed: true, isOptional: true },
            { name: 'address_id', type: 'string', isIndexed: true },
            { name: 'tx_extra_id', type: 'string', isIndexed: true },
            { name: 'tx_payload_id', type: 'string', isIndexed: true },
          ],
        }),
        createTable({
          name: TableName.TxExtra,
          columns: [
            { name: 'ok', type: 'boolean', isOptional: true },
            { name: 'contract_creation', type: 'boolean', isOptional: true },
            { name: 'simple', type: 'boolean', isOptional: true },
            { name: 'send_action', type: 'string', isOptional: true },
            { name: 'contract_interaction', type: 'boolean', isOptional: true },
            { name: 'token20', type: 'boolean', isOptional: true },
            { name: 'token_nft', type: 'boolean', isOptional: true },
            { name: 'address', type: 'string', isOptional: true },
            { name: 'method', type: 'string', isOptional: true },
          ],
        }),
        createTable({
          name: TableName.TxPayload,
          columns: [
            { name: 'type', type: 'string', isOptional: true },
            { name: 'access_list', type: 'string', isOptional: true },
            { name: 'max_fee_per_gas', type: 'string', isOptional: true },
            { name: 'max_priority_fee_per_gas', type: 'string', isOptional: true },
            { name: 'from', type: 'string', isOptional: true },
            { name: 'to', type: 'string', isOptional: true },
            { name: 'gas_price', type: 'string' },
            { name: 'gas', type: 'string' },
            { name: 'storage_limit', type: 'string', isOptional: true },
            { name: 'data', type: 'string', isOptional: true },
            { name: 'value', type: 'string' },
            { name: 'nonce', type: 'number' },
            { name: 'chain_identification', type: 'string' },
            { name: 'epoch_height', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: TableName.Vault,
          columns: [
            {
              name: 'is_backup',
              type: 'boolean',
            },
            {
              name: 'source',
              type: 'string',
            },
          ],
        }),
      ],
    },
  ],
});

export default migrations;

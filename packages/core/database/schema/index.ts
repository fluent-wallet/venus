import { appSchema, tableSchema } from '@nozbe/watermelondb';
import TableName from '../TableName';

// WatermelonDB can not define a unique column.
// We will should do some prevent duplicates manually.
// see: https://github.com/Nozbe/WatermelonDB/issues/198. https://github.com/Nozbe/WatermelonDB/issues/36
// isIndexed: true. Indexing makes querying by a column faster.Should add later
const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: TableName.HdPath,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'value', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.Network,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'endpoint', type: 'string' },
        { name: 'net_identification', type: 'number' },
        { name: 'gas_buffer', type: 'number' },
        { name: 'chain_identification', type: 'string' },
        { name: 'network_type', type: 'string' },
        { name: 'chain_type', type: 'string' },
        { name: 'builtin', type: 'boolean', isOptional: true },
        { name: 'scan_url', type: 'string', isOptional: true },
        { name: 'selected', type: 'boolean' },
        { name: 'hd_path_id', type: 'string', isIndexed: true },
        { name: 'endpoints_list', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.Asset,
      columns: [
        { name: 'asset_rule_id', type: 'string', isIndexed: true },
        { name: 'contract_address', type: 'string', isIndexed: true },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'network_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'symbol', type: 'string', isOptional: true },
        { name: 'decimals', type: 'number', isOptional: true },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'price_in_usdt', type: 'string', isOptional: true },
        { name: 'source', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: TableName.AssetRule,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'index', type: 'number' },
        { name: 'network_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
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
    tableSchema({
      name: TableName.Tx,
      columns: [
        { name: 'raw', type: 'string', isOptional: true },
        { name: 'hash', type: 'string' },
        // tx status
        { name: 'status', type: 'string' },
        { name: 'source', type: 'string' },
        { name: 'method', type: 'string' },
        // executed status
        { name: 'executed_status', type: 'string', isOptional: true },
        // @json
        { name: 'receipt', type: 'string', isOptional: true },
        { name: 'confirmed_number', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'executed_at', type: 'number', isOptional: true },
        { name: 'error_type', type: 'string', isOptional: true },
        { name: 'err', type: 'string', isOptional: true },
        // deprecated
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
    tableSchema({
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
    tableSchema({
      name: TableName.TxPayload,
      columns: [
        { name: 'type', type: 'string', isOptional: true },
        // For Berlin hardFork.
        // @json
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
        // chainId
        { name: 'chain_identification', type: 'string' },
        { name: 'epoch_height', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: TableName.Vault,
      columns: [
        // Type of vault: pub, pk, hd, hw
        { name: 'type', type: 'string' },
        // Encrypted vault data
        { name: 'data', type: 'string', isOptional: true },
        { name: 'device', type: 'string' },
        // If type is pub/hw, means this vault is only for cfx type network, if type is hd, means only generate 0x1 prefix account.
        { name: 'cfx_only', type: 'boolean', isOptional: true },
        { name: 'is_backup', type: 'boolean' },
        { name: 'source', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.AccountGroup,
      columns: [
        // Type of vault: pub, pk, hd, hw
        { name: 'nickname', type: 'string' },
        { name: 'hidden', type: 'boolean' },
        { name: 'vault_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: TableName.Account,
      columns: [
        { name: 'index', type: 'number' },
        { name: 'nickname', type: 'string' },
        { name: 'hidden', type: 'boolean' },
        { name: 'selected', type: 'boolean', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'account_group_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: TableName.Address,
      columns: [
        { name: 'account_id', type: 'string', isIndexed: true },
        { name: 'network_id', type: 'string', isIndexed: true },
        { name: 'asset_rule_id', type: 'string', isIndexed: true },
        { name: 'base32', type: 'string' },
        { name: 'hex', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.AddressBook,
      columns: [
        { name: 'address_id', type: 'string', isIndexed: true },
        { name: 'network_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'address_value', type: 'string' },
        { name: 'type', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.Permission,
      columns: [
        { name: 'type', type: 'string' },
        { name: 'rule', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'app_id', type: 'string', isIndexed: true },
        { name: 'network_id', type: 'string', isIndexed: true },
        { name: 'account_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: TableName.App,
      columns: [
        { name: 'identity', type: 'string', isIndexed: true },
        { name: 'origin', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: TableName.Request,
      columns: [
        { name: 'type', type: 'string' },
        { name: 'value', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'app_id', type: 'string', isIndexed: true },
      ],
    }),
  ],
});

export default schema;

import { appSchema, tableSchema } from '@nozbe/watermelondb';
import TableName from '../TableName';

// WatermelonDB can not define a unique column.
// We will should do some prevent duplicates manually.
// see: https://github.com/Nozbe/WatermelonDB/issues/198. https://github.com/Nozbe/WatermelonDB/issues/36
// isIndexed: true. Indexing makes querying by a column faster.Should add later
const schema = appSchema({
  version: 1,
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
        { name: 'builtin', type: 'boolean', isOptional: true },
        { name: 'scan_url', type: 'string', isOptional: true },
        { name: 'selected', type: 'boolean' },
        { name: 'cache_time', type: 'number', isOptional: true },
        { name: 'balance_checker', type: 'string', isOptional: true },
        { name: 'hd_path_id', type: 'string', isIndexed: true },
        { name: 'ticker_id', type: 'string', isIndexed: true },
        { name: 'token_list_id', type: 'string', isOptional: true },
        { name: 'chain_type', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.Ticker,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'decimals', type: 'number' },
        // iconUrls could be array should use @json
        { name: 'icon_urls', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: TableName.TokenList,
      columns: [
        { name: 'url', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'value', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: TableName.Token,
      columns: [
        { name: 'token_list_id', type: 'string', isIndexed: true },
        { name: 'network_id', type: 'string', isIndexed: true },
        { name: 'address_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'token_address', type: 'string' },
        { name: 'symbol', type: 'string', isOptional: true },
        { name: 'decimals', type: 'number', isOptional: true },
        { name: 'logo_uri', type: 'string', isOptional: true },
        { name: 'from_list', type: 'boolean' },
        { name: 'from_app', type: 'boolean' },
        { name: 'from_user', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: TableName.TokenBalance,
      columns: [
        // hex value of token balance
        { name: 'value', type: 'string' },
        { name: 'token_id', type: 'string', isIndexed: true },
        { name: 'address_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: TableName.Tx,
      columns: [
        { name: 'raw', type: 'string' },
        { name: 'hash', type: 'string' },
        // int, tx status, -2 skipped, -1 failed, 0 unsent, 1 sending, 2 pending, 3 packaged, 4 executed, 5 confirmed
        { name: 'status', type: 'number' },
        // @json
        { name: 'receipt', type: 'string', isOptional: true },
        { name: 'block_number', type: 'number', isOptional: true },
        { name: 'block_hash', type: 'string', isOptional: true },
        { name: 'chain_switched', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'pending_at', type: 'number', isOptional: true },
        { name: 'err', type: 'string', isOptional: true },
        { name: 'from_fluent', type: 'boolean', isOptional: true },
        { name: 'from_scan', type: 'boolean', isOptional: true },
        { name: 'resend_at', type: 'number', isOptional: true },
        { name: 'token_id', type: 'string', isIndexed: true, isOptional: true },
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
        { name: 'simple', type: 'boolean' },
        { name: 'send_action', type: 'string' },
        { name: 'contract_interaction', type: 'boolean', isOptional: true },
        { name: 'token20', type: 'boolean', isOptional: true },
        { name: 'token_nft', type: 'boolean' },
        { name: 'address', type: 'string' },
        { name: 'method', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: TableName.TxPayload,
      columns: [
        // For Berlin hardFork.
        { name: 'access_list', type: 'string' },
        { name: 'max_fee_per_gas', type: 'string' },
        { name: 'max_priority_fee_per_gas', type: 'string' },
        { name: 'from', type: 'string' },
        { name: 'to', type: 'string' },
        { name: 'gas_price', type: 'string' },
        { name: 'gas', type: 'string' },
        { name: 'storage_limit', type: 'string' },
        { name: 'data', type: 'string', isOptional: true },
        { name: 'value', type: 'string' },
        { name: 'nonce', type: 'string' },
        // chainId
        { name: 'chain_identification', type: 'string' },
        { name: 'epoch_height', type: 'string' },
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
        { name: 'base32', type: 'string' },
        { name: 'hex', type: 'string' },
        { name: 'native_balance', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.Memo,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'address', type: 'string' },
        { name: 'network_id', type: 'string', isIndexed: true },
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
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'site_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: TableName.Site,
      columns: [
        { name: 'origin', type: 'string' },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'icon', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: TableName.Request,
      columns: [
        { name: 'type', type: 'string' },
        { name: 'processed', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'app_id', type: 'string', isIndexed: true },
      ],
    }),
  ],
});

export default schema;

import {appSchema, tableSchema} from '@nozbe/watermelondb';

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'posts',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'subtitle', type: 'string', isOptional: true},
        {name: 'comment_id', type: 'string', isIndexed: true},
        {name: 'body', type: 'string'},
        {name: 'is_pinned', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'comments',
      columns: [
        {name: 'body', type: 'string'},
        {name: 'post_id', type: 'string', isIndexed: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
  ],
});

// WatermelonDB can not define a unique column.
// We will should do some prevent duplicates manually.
// see: https://github.com/Nozbe/WatermelonDB/issues/198. https://github.com/Nozbe/WatermelonDB/issues/36
// isIndexed: true. Indexing makes querying by a column faster.Should add later

const DBTABLESCHEMAS = [
  {
    name: 'hd_path',
    columns: [
      {name: 'name', type: 'string'},
      {name: 'value', type: 'string'},
    ],
  },

  {
    name: 'network',
    columns: [
      {name: 'name', type: 'string'},
      {name: 'icon', type: 'string', isOptional: true},
      {name: 'endpoint', type: 'string'},
      {name: 'hd_path_id', type: 'string', isIndexed: true},
      {name: 'netId', type: 'number'},
      //TODO: 可以再建一个表 不用@json 这种方式
      {name: 'ticker', type: 'string', isOptional: true},
      {name: 'builtin', type: 'string'},
      {name: 'scan_url', type: 'string', isOptional: true},
      {name: 'selected', type: 'boolean', isOptional: true},
      {name: 'cache_time', type: 'number', isOptional: true},
      {name: 'token_list_id', type: 'string', isOptional: true},
      {name: 'balance_checker', type: 'string', isOptional: true},
      {name: 'is_mainnet', type: 'boolean'},
      {name: 'is_testnet', type: 'boolean'},
      {name: 'is_custom', type: 'boolean'},
    ],
  },
  {
    name: 'token_list',
    columns: [
      {name: 'url', type: 'string'},
      {name: 'name', type: 'string'},
      {name: 'value', type: 'string'},
    ],
  },
  {
    name: 'token',
    columns: [
      // one to many ref to token_list
      {name: 'token_list_id', type: 'string'},
      {name: 'network_id', type: 'string', isIndexed: true},
      {name: 'name', type: 'string'},
      {name: 'address', type: 'string'},
      {name: 'symbol', type: 'string', isOptional: true},
      {name: 'decimals', type: 'number', isOptional: true},
      {name: 'logo_uri', type: 'string', isOptional: true},
      {name: 'from_list', type: 'boolean'},
      {name: 'from_app', type: 'boolean'},
      {name: 'from_user', type: 'boolean'},
    ],
  },
  {
    name: 'token_balance',
    columns: [
      // hex value of token balance
      {name: 'value', type: 'string'},
      {name: 'token_id', type: 'string'},
      {name: 'address_id', type: 'string'},
    ],
  },
  {
    name: 'tx',
    columns: [
      {name: 'token_id', type: 'string'},
      {name: 'address_id', type: 'string'},
      {name: 'raw', type: 'string'},
      {name: 'hash', type: 'string'},
      // int, tx status, -2 skipped, -1 failed, 0 unsent, 1 sending, 2 pending, 3 packaged, 4 executed, 5 confirmed
      {name: 'status', type: 'string'},
      {name: 'receipt', type: 'string', isOptional: true},
      {name: 'block_number', type: 'number', isOptional: true},
      {name: 'block_hash', type: 'string', isOptional: true},
      {name: 'chain_switched', type: 'boolean', isOptional: true},
      {name: 'created_at', type: 'number'},
      {name: 'pending_at', type: 'number', isOptional: true},
      {name: 'err', type: 'string', isOptional: true},
      {name: 'from_fluent', type: 'boolean', isOptional: true},
      {name: 'from_scan', type: 'boolean', isOptional: true},
      {name: 'resend_at', type: 'number', isOptional: true},
    ],
  },
  {
    name: 'tx_extra',
    columns: [
      {name: 'tx_id', type: 'string'},
      {name: 'ok', type: 'boolean'},
      {name: 'contract_creation', type: 'string'},
      {name: 'simple', type: 'boolean'},
      {name: 'send_action', type: 'string'},
      {name: 'contract_interaction', type: 'string'},
      {name: 'token20', type: 'string'},
      {name: 'token_nft', type: 'string'},
      {name: 'contract_interaction', type: 'string'},
      {name: 'address', type: 'string'},
      {name: 'method', type: 'string'},
    ],
  },
  {
    name: 'tx_payload',
    columns: [
      {name: 'tx_id', type: 'string'},
      {name: 'access_list', type: 'string'},
      {name: 'max_fee_per_gas', type: 'string'},
      {name: 'max_priority_fee_per_gas', type: 'string'},
      {name: 'from', type: 'string'},
      {name: 'to', type: 'string'},
      {name: 'gas_price', type: 'string'},
      {name: 'gas', type: 'string'},
      {name: 'storage_limit', type: 'string'},
      {name: 'data', type: 'string'},
      {name: 'value', type: 'string'},
      {name: 'nonce', type: 'string'},
      {name: 'chain_identification', type: 'string'},
      {name: 'epoch_height', type: 'string'},
    ],
  },
];
const schema2 = appSchema({
  version: 1,
  tables: DBTABLESCHEMAS.map(item => tableSchema(item)),
});

export default schema;

import {Model} from '@nozbe/watermelondb';
import {
  field,
  text,
  children,
  relation,
  readonly,
  date,
  immutableRelation,
} from '@nozbe/watermelondb/decorators';

export class HdPath extends Model {
  static table = 'hd_path';
  static associations = {
    network: {type: 'has_many', foreignKey: 'hd_path_id'},
  };

  @text('name') name;
  @text('value') value;
}

export class Network extends Model {
  static table = 'network';
  static associations = {
    hdPath: {type: 'belongs_to', key: 'hd_path_id'},
    ticker: {type: 'belongs_to', key: 'ticker_id'},
    tokenList: {type: 'belongs_to', key: 'token_list_id'},
    token: {type: 'has_many', foreignKey: 'network_id'},
  };

  @children('token') token;
  @text('name') name;
  @text('icon') icon;
  @text('endpoint') endpoint;
  @field('net_identification') netId;
  @field('gas_buffer') gasBuffer;
  @text('chain_identification') chainId;
  @text('network_type') networkType;
  @field('builtin') builtin;
  @text('scan_url') scanUrl;
  @field('selected') selected;
  @field('cache_time') cacheTime;
  @text('balance_checker') balanceChecker;
  @field('is_mainnet') isMainnet;
  @field('is_testnet') isTestnet;
  @field('is_custom') isCustom;
  @relation('hd_path', 'hd_path_id') hdPath;
  @immutableRelation('ticker', 'ticker_id') ticker;
  @immutableRelation('token_list', 'token_list_id') tokenList;
}

export class Ticker extends Model {
  static table = 'ticker';
  static associations = {
    network: {type: 'has_many', key: 'ticker_id'},
  };

  @text('name') name;
  @text('symbol') symbol;
  @field('decimals') decimals;
  @text('icon_urls') iconUrls;
}

export class TokenList extends Model {
  static table = 'token_list';
  static associations = {
    network: {type: 'has_many', foreignKey: 'token_list_id'},
  };
  @children('token') token;
  @text('url') url;
  @text('name') name;
  @field('value') value;
}

export class Token extends Model {
  static table = 'token';
  static associations = {
    network: {type: 'belongs_to', key: 'network_id'},
    address: {type: 'belongs_to', key: 'address_id'},
  };

  @children('token_balance') tokenBalance;
  @children('tx') tx;

  @immutableRelation('network', 'network_id') network;
  @text('name') name;
  @text('token_address') tokenAddress;
  @text('symbol') symbol;
  @field('decimals') decimals;
  @text('logo_uri') logoURI;
  @field('from_list') fromList;
  @field('from_app') fromApp;
  @field('from_user') fromUser;
}

export class TokenBalance extends Model {
  static table = 'token_balance';
  @text('value') value;
  @immutableRelation('address', 'address_id') address;
}

export class Tx extends Model {
  static table = 'tx';

  @text('raw') raw;
  @text('hash') hash;
  @field('status') status;
  @text('receipt') receipt;
  @field('block_number') blockNumber;
  @text('block_hash') blockHash;
  @field('chain_switched') chainSwitched;
  @readonly @date('created_at') createdAt;
  @date('pending_at') pendingAt;
  @text('err') err;
  @field('from_fluent') fromFluent;
  @field('from_scan') fromScan;
  @date('resend_at') resendAt;
  @relation('tx_extra', 'tx_extra_id') txExtra;
  @relation('tx_payload', 'tx_payload_id') txPayload;
}

export class TxExtra extends Model {
  static table = 'tx_extra';
  @field('ok') ok;
  @field('contract_creation') contractCreation;
  @field('simple') simple;
  @text('send_action') sendAction;
  @field('contract_interaction') contractInteraction;
  @field('token20') token20;
  @field('token_nft') tokenNft;
  @text('address') address;
  @text('method') method;
}

export class TxPayload extends Model {
  static table = 'tx_payload';
  @text('access_list') accessList;
  @text('max_fee_per_gas') maxFeePerGas;
  @text('max_priority_fee_per_gas') maxPriorityFeePerGas;
  @text('from') from;
  @text('to') to;
  @text('gas_price') gasPrice;
  @text('gas') gas;
  @text('storage_limit') storageLimit;
  @text('data') data;
  @text('value') value;
  @text('nonce') nonce;
  @text('chain_identification') chainId;
  @text('epoch_height') epochHeight;
}

export class AccountGroup extends Model {
  static table = 'account_group';
  static associations = {
    account: {type: 'has_many', foreignKey: 'account_group_id'},
    vault: {type: 'belongs_to', key: 'vault_id'},
  };

  @children('account') account;
  @field('nickname') nickname;
  @field('hidden') hidden;
  @immutableRelation('vault', 'vault_id') vault;
}

export class Vault extends Model {
  static table = 'vault';
  static associations = {
    account_group: {type: 'has_many', foreignKey: 'vault_id'},
  };

  @text('type') type;
  @field('data') data;
  @text('device') device;
  @field('cfx_only') cfxOnly;
}

export class Account extends Model {
  static table = 'account';
  static associations = {
    address: {type: 'has_many', foreignKey: 'account_id'},
    accountGroup: {type: 'belongs_to', key: 'account_group_id'},
  };

  @children('address') address;
  @field('index') index;
  @field('nickname') nickname;
  @field('hidden') hidden;
  @field('selected') selected;
  @relation('account_group', 'account_group_id') accountGroup;
}

export class Address extends Model {
  static table = 'address';
  static associations = {
    account: {type: 'belongs_to', key: 'account_id'},
    network: {type: 'belongs_to', key: 'network_id'},
    token: {type: 'has_many', key: 'address_id'},
  };

  @children('token') token;
  @children('token_balance') tokenBalance;
  @children('tx') tx;
  @text('value') value;
  @text('hex') hex;
  @text('pk') pk;
  @text('native_balance') nativeBalance;
  @relation('account', 'account_id') account;
  @relation('network', 'network_id') network;
}

export class Memo extends Model {
  static table = 'memo';

  @text('name') name;
  @text('address') address;
  @relation('network', 'network_id') network;
}

import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, relation, readonly, date, immutableRelation } from '@nozbe/watermelondb/decorators';
import { TableName } from './index';

export class HdPath extends Model {
  static table = TableName.HdPath;
  static associations = {
    [TableName.Network]: { type: 'has_many', foreignKey: 'hd_path_id' },
  } as const;

  @text('name') name!: string;
  @text('value') value!: string;
  @children(TableName.Network) network!: Query<Network>;
}

export class Network extends Model {
  static table = TableName.Network;
  static associations = {
    [TableName.HdPath]: { type: 'belongs_to', key: 'hd_path_id' },
    [TableName.Ticker]: { type: 'belongs_to', key: 'ticker_id' },
    [TableName.TokenList]: { type: 'belongs_to', key: 'token_list_id' },
    [TableName.Token]: { type: 'has_many', foreignKey: 'network_id' },
  } as const;

  @text('name') name!: string;
  @text('icon') icon!: string | null;
  @text('endpoint') endpoint!: string;
  @field('net_identification') netId!: number;
  @field('gas_buffer') gasBuffer!: number;
  @text('chain_identification') chainId!: string;
  @text('network_type') networkType!: string;
  @field('builtin') builtin!: boolean | null;
  @text('scan_url') scanUrl!: string | null;
  @field('selected') selected!: boolean | null;
  @field('cache_time') cacheTime!: number | null;
  @text('balance_checker') balanceChecker!: string | null;
  @field('is_mainnet') isMainnet!: boolean;
  @field('is_testnet') isTestnet!: boolean;
  @field('is_custom') isCustom!: boolean;
  @children(TableName.Token) token!: Query<Token>;
  @relation(TableName.HdPath, 'hd_path_id') hdPath!: Relation<HdPath>;
  @immutableRelation(TableName.Ticker, 'ticker_id') ticker!: Relation<Ticker>;
  @immutableRelation(TableName.TokenList, 'token_list_id') tokenList!: Relation<TokenList> | null;
}

export class Ticker extends Model {
  static table = TableName.Ticker;
  static associations = {
    [TableName.Network]: { type: 'has_many', foreignKey: 'ticker_id' },
  } as const;

  @text('name') name!: string;
  @text('symbol') symbol!: string;
  @field('decimals') decimals!: number;
  @text('icon_urls') iconUrls!: string | null;
  @children(TableName.Network) network!: Query<Network>;
}

export class TokenList extends Model {
  static table = TableName.TokenList;
  static associations = {
    [TableName.Token]: { type: 'has_many', foreignKey: 'token_list_id' },
  } as const;

  @text('url') url!: string;
  @text('name') name!: string;
  @text('value') value!: string | null;
  @children(TableName.Token) token!: Query<Token>;
}

export class Token extends Model {
  static table = TableName.Token;
  static associations = {
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.TokenList]: { type: 'belongs_to', key: 'token_list_id' },
    [TableName.TokenBalance]: { type: 'has_many', foreignKey: 'token_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'token_id' },
  } as const;

  @text('name') name!: string;
  @text('token_address') tokenAddress!: string;
  @text('symbol') symbol!: string | null;
  @field('decimals') decimals!: number | null;
  @text('logo_uri') logoURI!: string | null;
  @field('from_list') fromList!: boolean;
  @field('from_app') fromApp!: boolean;
  @field('from_user') fromUser!: boolean;
  @children(TableName.TokenBalance) tokenBalance!: Query<TokenBalance>;
  @children(TableName.Tx) tx!: Query<Tx>;
  @immutableRelation(TableName.TokenList, 'token_list_id') tokenList!: Relation<TokenList>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
}

export class TokenBalance extends Model {
  static table = TableName.TokenBalance;
  static associations = {
    [TableName.Token]: { type: 'belongs_to', key: 'token_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
  } as const;

  @text('value') value!: string;
  @immutableRelation(TableName.Token, 'token_id') token!: Relation<Token>;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
}

export class Tx extends Model {
  static table = TableName.Tx;
  static associations = {
    [TableName.Token]: { type: 'belongs_to', key: 'token_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.TxExtra]: { type: 'belongs_to', key: 'tx_extra_id' },
    [TableName.TxPayload]: { type: 'belongs_to', key: 'tx_payload_id' },
  } as const;

  @text('raw') raw!: string;
  @text('hash') hash!: string;
  @field('status') status!: number;
  @text('receipt') receipt!: string | null;
  @field('block_number') blockNumber!: number | null;
  @text('block_hash') blockHash!: string | null;
  @field('chain_switched') chainSwitched!: boolean | null;
  @readonly @date('created_at') createdAt!: Date;
  @date('pending_at') pendingAt!: number | null;
  @text('err') err!: string | null;
  @field('from_fluent') fromFluent!: boolean | null;
  @field('from_scan') fromScan!: boolean | null;
  @date('resend_at') resendAt!: number | null;
  @immutableRelation(TableName.Token, 'token_id') token!: Relation<Token> | null;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
  @immutableRelation(TableName.TxExtra, 'tx_extra_id') txExtra!: Relation<TxExtra>;
  @immutableRelation(TableName.TxPayload, 'tx_payload_id') txPayload!: Relation<TxPayload>;
}

export class TxExtra extends Model {
  static table = TableName.TxExtra;

  @field('ok') ok!: boolean | null;
  @field('contract_creation') contractCreation!: boolean | null;
  @field('simple') simple!: boolean;
  @text('send_action') sendAction!: string;
  @field('contract_interaction') contractInteraction!: boolean | null;
  @field('token20') token20!: boolean | null;
  @field('token_nft') tokenNft!: boolean;
  @text('address') address!: string;
  @text('method') method!: string | null;
}

export class TxPayload extends Model {
  static table = TableName.TxPayload;

  @text('access_list') accessList!: string;
  @text('max_fee_per_gas') maxFeePerGas!: string;
  @text('max_priority_fee_per_gas') maxPriorityFeePerGas!: string;
  @text('from') from!: string;
  @text('to') to!: string;
  @text('gas_price') gasPrice!: string;
  @text('gas') gas!: string;
  @text('storage_limit') storageLimit!: string;
  @text('data') data!: string | null;
  @text('value') value!: string;
  @text('nonce') nonce!: string;
  @text('chain_identification') chainId!: string;
  @text('epoch_height') epochHeight!: string;
}

export class AccountGroup extends Model {
  static table = TableName.AccountGroup;
  static associations = {
    [TableName.Account]: { type: 'has_many', foreignKey: 'account_group_id' },
    [TableName.Vault]: { type: 'belongs_to', key: 'vault_id' },
  } as const;

  @text('nickname') nickname!: string;
  @field('hidden') hidden!: boolean;
  @children(TableName.Account) account!: Query<Account>;
  @immutableRelation(TableName.Vault, 'vault_id') vault!: Relation<Vault>;
}

export class Vault extends Model {
  static table = TableName.Vault;
  static associations = {
    [TableName.AccountGroup]: { type: 'has_many', foreignKey: 'vault_id' },
  } as const;

  @text('type') type!: string;
  @text('data') data!: string;
  @text('device') device!: string;
  @field('cfx_only') cfxOnly!: boolean | null;
  @children(TableName.AccountGroup) accountGroup!: Query<AccountGroup>;
}

export class Account extends Model {
  static table = TableName.Account;
  static associations = {
    [TableName.Address]: { type: 'has_many', foreignKey: 'account_id' },
    [TableName.AccountGroup]: { type: 'belongs_to', key: 'account_group_id' },
  } as const;

  @field('index') index!: number;
  @text('nickname') nickname!: string;
  @field('hidden') hidden!: boolean;
  @field('selected') selected!: boolean;
  @children(TableName.Address) address!: Query<Address>;
  @relation(TableName.AccountGroup, 'account_group_id') accountGroup!: Relation<AccountGroup>;
}

export class Address extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Account]: { type: 'belongs_to', key: 'account_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Token]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.TokenBalance]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'address_id' },
  } as const;

  @text('value') value!: string;
  @text('hex') hex!: string;
  @text('pk') pk!: string;
  @text('native_balance') nativeBalance!: string;
  @children(TableName.Token) token!: Query<Token>;
  @children(TableName.TokenBalance) tokenBalance!: Query<TokenBalance>;
  @children(TableName.Tx) tx!: Query<Tx>;
  @relation(TableName.Account, 'account_id') account!: Relation<Account>;
  @relation(TableName.Network, 'network_id') network!: Relation<Network>;
}

export class Memo extends Model {
  static table = TableName.Memo;
  static associations = {
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
  } as const;

  @text('name') name!: string;
  @text('address') address!: string;
  @relation(TableName.Network, 'network_id') network!: Relation<Network>;
}

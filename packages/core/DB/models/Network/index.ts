import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, relation, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type TokenList } from '../TokenList';
import { type Ticker } from '../Ticker';
import { type Token } from '../Token';
import { type HdPath } from '../HdPath';
import TableName from '../../TableName';
import { createModel } from '../../helper/modelHelper';

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

type Params = Pick<Network, 'name' | 'endpoint' | 'netId' | 'gasBuffer' | 'chainId' | 'networkType' | 'isMainnet' | 'isTestnet' | 'isCustom'> &
  Partial<Pick<Network, 'icon' | 'builtin' | 'scanUrl' | 'selected' | 'cacheTime' | 'balanceChecker'>>;
export function createNetwork(params: Params, prepareCreate: true): Network;
export function createNetwork(params: Params): Promise<Network>;
export function createNetwork(params: Params, prepareCreate?: true) {
  return createModel<Network>({ name: TableName.Network, params, prepareCreate });
}

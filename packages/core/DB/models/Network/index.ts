import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, relation, immutableRelation, writer } from '@nozbe/watermelondb/decorators';
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
  @text('chain_type') chainType!: 'mainnet' | 'testnet' | 'custom';
  @children(TableName.Token) token!: Query<Token>;
  @relation(TableName.HdPath, 'hd_path_id') hdPath!: Relation<HdPath>;
  @immutableRelation(TableName.Ticker, 'ticker_id') ticker!: Relation<Ticker>;
  @immutableRelation(TableName.TokenList, 'token_list_id') tokenList!: Relation<TokenList>;

  setRelation(params: { hdPath?: HdPath; ticker?: Ticker; tokenList?: TokenList }, prepareUpdate: true): Network;
  setRelation(params: { hdPath?: HdPath; ticker?: Ticker; tokenList?: TokenList }): Promise<Network>;
  @writer setRelation({ hdPath, ticker, tokenList }: { hdPath?: HdPath; ticker?: Ticker; tokenList?: TokenList }, prepareUpdate?: true) {
    return this[prepareUpdate ? 'prepareUpdate' : 'update']((network) => {
      if (hdPath) {
        network.hdPath.set(hdPath);
      }
      if (ticker) {
        network.ticker.set(ticker);
      }
      if (tokenList) {
        network.tokenList.set(tokenList);
      }
    }) as Network | Promise<Network>;
  }
}

export type NetworkParams = Pick<Network, 'name' | 'endpoint' | 'netId' | 'gasBuffer' | 'chainId' | 'networkType' | 'chainType'> &
  Partial<Pick<Network, 'icon' | 'builtin' | 'scanUrl' | 'selected' | 'cacheTime' | 'balanceChecker'>>;
export function createNetwork(params: NetworkParams, prepareCreate: true): Network;
export function createNetwork(params: NetworkParams): Promise<Network>;
export function createNetwork(params: NetworkParams, prepareCreate?: true) {
  return createModel<Network>({ name: TableName.Network, params, prepareCreate });
}
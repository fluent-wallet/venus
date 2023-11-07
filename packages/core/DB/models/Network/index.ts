import { Model, type Query, type Relation, Q } from '@nozbe/watermelondb';
import { field, text, children, relation, immutableRelation, writer } from '@nozbe/watermelondb/decorators';
import { type TokenList } from '../TokenList';
import { type Ticker } from '../Ticker';
import { type Token } from '../Token';
import { type HdPath } from '../HdPath';
import TableName from '../../TableName';

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
  @text('network_type') networkType!: 'cfx' | 'eth';
  @field('builtin') builtin!: boolean | null;
  @text('scan_url') scanUrl!: string | null;
  @field('selected') selected!: boolean;
  @field('cache_time') cacheTime!: number | null;
  @text('balance_checker') balanceChecker!: string | null;
  @text('chain_type') chainType!: 'mainnet' | 'testnet' | 'custom';
  @children(TableName.Token) token!: Query<Token>;
  @relation(TableName.HdPath, 'hd_path_id') hdPath!: Relation<HdPath>;
  @immutableRelation(TableName.Ticker, 'ticker_id') ticker!: Relation<Ticker>;
  @immutableRelation(TableName.TokenList, 'token_list_id') tokenList!: Relation<TokenList>;

  @writer async switchESpaceNetwork() {
    const [network] = await this.collections
      .get<Network>(TableName.Network)
      .query(Q.where('name', this.name === 'eSpace Testnet' ? 'Conflux eSpace' : 'eSpace Testnet'));
      
    this.batch(
      this.prepareUpdate((network) => {
        network.selected = false;
      }),
      network
        ? network.prepareUpdate((network) => {
            network.selected = true;
          })
        : undefined
    );
  }
}

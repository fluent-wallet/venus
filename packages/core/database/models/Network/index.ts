import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, relation, lazy } from '@nozbe/watermelondb/decorators';
import { firstValueFrom, map } from 'rxjs';
import { type Asset, AssetType } from '../Asset';
import { type AssetRule } from '../AssetRule';
import { type HdPath } from '../HdPath';
import TableName from '../../TableName';

export enum NetworkType {
  Conflux = 'Conflux',
  Ethereum = 'Ethereum',
}

export enum ChainType {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Custom = 'Custom',
}

export class Network extends Model {
  static table = TableName.Network;
  static associations = {
    [TableName.HdPath]: { type: 'belongs_to', key: 'hd_path_id' },
    [TableName.Asset]: { type: 'has_many', foreignKey: 'network_id' },
    [TableName.AssetRule]: { type: 'has_many', foreignKey: 'network_id' },
  } as const;

  @text('name') name!: string;
  @text('endpoint') endpoint!: string;
  @field('net_identification') netId!: number;
  @text('chain_identification') chainId!: string;
  @field('gas_buffer') gasBuffer!: number;
  @text('network_type') networkType!: NetworkType;
  @text('chain_type') chainType!: ChainType;
  @text('icon') icon!: string | null;
  @text('scan_url') scanUrl!: string | null;
  @field('selected') selected!: boolean;
  @field('builtin') builtin!: boolean | null;
  @children(TableName.Asset) assets!: Query<Asset>;
  @children(TableName.AssetRule) assetRules!: Query<AssetRule>;
  @relation(TableName.HdPath, 'hd_path_id') hdPath!: Relation<HdPath>;

  queryAssetByAddress = (address: string) =>
    firstValueFrom(
      this.assets
        .extend(Q.where('contract_address', address))
        .observe()
        .pipe(map((accounts) => accounts?.[0] as Asset | undefined))
    );

  @lazy nativeAssetQuery = this.assets.extend(Q.where('type', AssetType.Native));
  @lazy nativeAsset = firstValueFrom(this.nativeAssetQuery.observe().pipe(map((assets) => assets?.[0])));
  @lazy defaultAssetRuleQuery = this.assetRules.extend(Q.where('index', 0));
  @lazy defaultAssetRule = firstValueFrom(this.defaultAssetRuleQuery.observe().pipe(map((assetRules) => assetRules?.[0])));
}

import { injectable, inject } from 'inversify';
import { from, concatMap, firstValueFrom, toArray } from 'rxjs';
import { type Network } from '../../database/models/Network';
import VaultType from '../../database/models/Vault/VaultType';
import {
  createNetwork as _createNetwork,
  type NetworkParams,
  querySelectedNetwork,
  queryNetworkById,
  queryNetworkByChainId,
  queryNetworkByNetId,
} from '../../database/models/Network/query';
import { type Account } from '../../database/models/Account';
import { createAddress } from '../../database/models/Address/query';
import { AssetType } from '../../database/models/Asset';
import { createAsset } from '../../database/models/Asset/query';
import { createAssetRule } from '../../database/models/AssetRule/query';
import database from '../../database';
import TableName from '../../database/TableName';
import { getNthAccountOfHDKey } from '../../utils/hdkey';
import { fromPrivate } from '../../utils/account';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';

@injectable()
export class NetworkMethod {
  @inject(GetDecryptedVaultDataMethod) private getDecryptedVaultDataMethod!: GetDecryptedVaultDataMethod;

  async createNetwork(params: NetworkParams & { nativeAsset?: { name?: string; symbol?: string; decimals?: number; icon?: string } }, prepareCreate?: true) {
    if (!params.hdPath) throw new Error('HdPath is required in createNetwork.');
    const accounts = await database.get<Account>(TableName.Account).query().fetch();
    const network = _createNetwork(params, true);

    const defaultAssetRule = createAssetRule({ network, index: 0, name: 'default-rule' }, true);
    const nativeAsset = createAsset(
      {
        network,
        assetRule: defaultAssetRule,
        type: AssetType.Native,
        contractAddress: '',
        name: params.nativeAsset?.name || network.name.split(' ')?.[0] || 'Ether',
        symbol: params.nativeAsset?.symbol || network.name.split(' ')?.[0] || 'ETH',
        decimals: params.nativeAsset?.decimals || 18,
        icon: params.nativeAsset?.icon,
      },
      true
    );

    const hdPathValue = params.hdPath?.value;
    const newAddresses = await Promise.all(
      accounts.map(async (account) => {
        const addresses = await account.addresses.fetch();
        const allAddressHdPaths = await firstValueFrom(
          from(addresses).pipe(
            concatMap((address) => from(address.network.fetch())), // Get network for each address
            concatMap((network) => from(network.hdPath.fetch())), // Get HdPath for each network
            toArray()
          )
        );
        const sameHdPathIndex = allAddressHdPaths.findIndex((hdPath) => hdPath.value === hdPathValue);
        let hex: string;
        if (sameHdPathIndex !== -1) {
          hex = addresses[sameHdPathIndex].hex;
        } else {
          const vault = await (await account.accountGroup).vault;
          if (vault.type === VaultType.Hardware || vault.type === VaultType.BSIM) {
            hex = '';
          } else if (vault.type === VaultType.PublicAddress) {
            hex = vault.data!;
          } else {
            if (vault.type === VaultType.PrivateKey) {
              hex = fromPrivate(await this.getDecryptedVaultDataMethod.getPrivateKeyOfVault(vault)).address;
            } else {
              const mnemonic = await this.getDecryptedVaultDataMethod.getMnemonicOfVault(vault);
              const ret = await getNthAccountOfHDKey({
                mnemonic,
                hdPath: hdPathValue,
                nth: account.index,
              });
              hex = ret.hexAddress;
            }
          }
        }

        return createAddress({ network, assetRule: defaultAssetRule, account, hex }, true);
      })
    );

    if (prepareCreate) return [network, ...newAddresses, defaultAssetRule, nativeAsset];
    return database.write(async () => {
      await database.batch(network, ...newAddresses, defaultAssetRule, nativeAsset);
    });
  }

  async switchToNetwork(targetNetworkOrIdOrChainIdOrNetId: Network | string | number) {
    let targetNetwork: Network | undefined;
    if (typeof targetNetworkOrIdOrChainIdOrNetId === 'string') {
      targetNetwork = await queryNetworkById(targetNetworkOrIdOrChainIdOrNetId);
      if (!targetNetwork) targetNetwork = await queryNetworkByChainId(targetNetworkOrIdOrChainIdOrNetId);
    } else if (typeof targetNetworkOrIdOrChainIdOrNetId === 'number') {
      targetNetwork = await queryNetworkByNetId(targetNetworkOrIdOrChainIdOrNetId);
    } else {
      targetNetwork = targetNetworkOrIdOrChainIdOrNetId;
    }

    if (!targetNetwork) throw new Error('Network not found.');
    return database.write(async () => {
      if (targetNetwork!.selected) return;
      const selectedNetwork = await querySelectedNetwork();
      const updates = selectedNetwork
        .map((network) =>
          network.prepareUpdate((_network) => {
            _network.selected = false;
          })
        )
        .concat(
          targetNetwork!.prepareUpdate((_network) => {
            _network.selected = true;
          })
        );
      return await database.batch(...updates);
    });
  }
}

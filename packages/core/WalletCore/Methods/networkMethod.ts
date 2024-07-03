import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { inject, injectable } from 'inversify';
import { memoize } from 'lodash-es';
import { concatMap, firstValueFrom, from, toArray } from 'rxjs';
import database from '../../database';
import TableName from '../../database/TableName';
import type { Account } from '../../database/models/Account';
import { createAddress } from '../../database/models/Address/query';
import { AssetSource, AssetType } from '../../database/models/Asset';
import { createAsset } from '../../database/models/Asset/query';
import { createAssetRule } from '../../database/models/AssetRule/query';
import { type Network, NetworkType, networkRpcPrefixMap, networkRpcSuffixMap } from '../../database/models/Network';
import {
  type NetworkParams,
  createNetwork as _createNetwork,
  queryNetworkByChainId,
  queryNetworkById,
  queryNetworkByNetId,
  querySelectedNetwork,
} from '../../database/models/Network/query';
import VaultType from '../../database/models/Vault/VaultType';
import { fromPrivate } from '../../utils/account';
import { convertCfxToHex, validateCfxAddress, validateHexAddress } from '../../utils/address';
import { getNthAccountOfHDKey } from '../../utils/hdkey';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';

const getNetwork = async (targetNetworkOrIdOrChainIdOrNetId: Network | string | number): Promise<Network | undefined> => {
  let targetNetwork: Network | undefined;
  if (typeof targetNetworkOrIdOrChainIdOrNetId === 'string') {
    targetNetwork = await queryNetworkById(targetNetworkOrIdOrChainIdOrNetId);
    if (!targetNetwork) targetNetwork = await queryNetworkByChainId(targetNetworkOrIdOrChainIdOrNetId);
  } else if (typeof targetNetworkOrIdOrChainIdOrNetId === 'number') {
    targetNetwork = await queryNetworkByNetId(targetNetworkOrIdOrChainIdOrNetId);
  } else {
    targetNetwork = targetNetworkOrIdOrChainIdOrNetId;
  }
  return targetNetwork;
};

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
        source: AssetSource.Official,
      },
      true,
    );

    const hdPathValue = params.hdPath?.value;
    const newAddresses = await Promise.all(
      accounts.map(async (account) => {
        const addresses = await account.addresses.fetch();
        const allAddressHdPaths = await firstValueFrom(
          from(addresses).pipe(
            concatMap((address) => from(address.network.fetch())), // Get network for each address
            concatMap((network) => from(network.hdPath.fetch())), // Get HdPath for each network
            toArray(),
          ),
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
      }),
    );

    if (prepareCreate) return [network, ...newAddresses, defaultAssetRule, nativeAsset];
    return await database.write(async () => {
      await database.batch(network, ...newAddresses, defaultAssetRule, nativeAsset);
    });
  }

  async switchToNetwork(targetNetworkOrIdOrChainIdOrNetId: Network | string | number) {
    const targetNetwork = await getNetwork(targetNetworkOrIdOrChainIdOrNetId);

    if (!targetNetwork) throw new Error('Network not found.');
    return database.write(async () => {
      if (targetNetwork!.selected) return;
      const selectedNetwork = await querySelectedNetwork();
      const updates = selectedNetwork
        .map((network) =>
          network.prepareUpdate((_network) => {
            _network.selected = false;
          }),
        )
        .concat(
          targetNetwork!.prepareUpdate((_network) => {
            _network.selected = true;
          }),
        );
      return await database.batch(...updates);
    });
  }

  async updateCurrentEndpoint({ network, endpoint }: { network: Network | string | number; endpoint: string }) {
    const targetNetwork = await getNetwork(network);
    if (!targetNetwork) throw new Error('Network not found.');
    return targetNetwork.updateEndpoint(endpoint);
  }

  async removeEndpoint({ network, endpoint }: { network: Network | string | number; endpoint: string }) {
    const targetNetwork = await getNetwork(network);
    if (!targetNetwork) throw new Error('Network not found.');
    return targetNetwork.removeEndpoint(endpoint);
  }

  async queryAssetByAddress(networkId: string, address: string) {
    const targetNetwork = await getNetwork(networkId);
    if (!targetNetwork) throw new Error('Network not found.');
    return targetNetwork.queryAssetByAddress(address);
  }

  async addEndpoint({ network, endpointParams }: { network: Network | string | number; endpointParams: Network['endpointsList']['0'] }) {
    const targetNetwork = await getNetwork(network);
    if (!targetNetwork) throw new Error('Network not found.');
    return targetNetwork.addEndpoint(endpointParams);
  }

  _checkIsValidAddress({ networkType, addressValue }: { networkType: NetworkType; addressValue: string }) {
    if (!addressValue) return false;
    if (networkType === NetworkType.Conflux) {
      return validateCfxAddress(addressValue);
    }
    if (networkType === NetworkType.Ethereum) {
      return validateHexAddress(addressValue);
    }
    return false;
  }

  private _checkIsContractAddress({
    networkType,
    endpoint,
    addressValue,
  }: {
    networkType: NetworkType.Conflux;
    endpoint: string;
    addressValue: string;
  }): boolean;
  private _checkIsContractAddress({
    networkType,
    endpoint,
    addressValue,
  }: {
    networkType: NetworkType;
    endpoint: string;
    addressValue: string;
  }): Promise<boolean>;
  private _checkIsContractAddress({ networkType, endpoint, addressValue }: { networkType: NetworkType; endpoint: string; addressValue: string }) {
    if (networkType === NetworkType.Conflux) {
      try {
        const hex = convertCfxToHex(addressValue);
        return hex.startsWith('0x8');
      } catch (_) {
        return false;
      }
    } else {
      const rpcPrefix = networkRpcPrefixMap[networkType];
      const rpcSuffix = networkRpcSuffixMap[networkType];
      return new Promise((resolve, reject) =>
        fetchChain<string>({ url: endpoint, method: `${rpcPrefix}_getCode`, params: [addressValue, rpcSuffix] })
          .then(() => resolve(true))
          .catch((err) => {
            if (String(err)?.includes('timed out')) {
              reject(err);
            } else {
              resolve(false);
            }
          }),
      );
    }
  }

  checkIsContractAddress = memoize(this._checkIsContractAddress, (...args) => JSON.stringify(args));
  checkIsValidAddress = memoize(this._checkIsValidAddress, (...args) => JSON.stringify(args));
}

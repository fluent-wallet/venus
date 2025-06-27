import { injectable } from 'inversify';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { getPublicKey, sign } from '@noble/secp256k1';
import { SigningAlgorithm, type GetPublicKeyParams, type IKeyring, type SignParams } from './types';
import { VaultType } from '../../../core/database/models/Vault/VaultType';

@injectable()
export class KeyringServer implements IKeyring {
  private _getHDNode = async (mnemonic: string, basePath: string, index: number) => {
    const seed = await mnemonicToSeed(mnemonic);

    const rootNode = HDKey.fromMasterSeed(seed);

    // "m/44'/60'/0'/0/0" to "m/44'/60'/0'/0/index"
    const fullPath = `${basePath.replace(/\/$/, '')}/${index}`;

    return rootNode.derive(fullPath);
  };

  private async _getKeys(params: GetPublicKeyParams | SignParams): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
    let privateKey: Uint8Array;
    const { type } = params;
    if (type === VaultType.PrivateKey) {
      privateKey = params.privateKey;
    } else if (type === VaultType.HierarchicalDeterministic) {
      const childNode = await this._getHDNode(params.mnemonic, params.basePath, params.index);
      if (!childNode.privateKey) {
        throw new Error('Key derivation failed: HDNode does not have a private key');
      }
      privateKey = childNode.privateKey;
    } else {
      throw new Error(`Unsupported vault type: ${type}`);
    }
    const publicKey = getPublicKey(privateKey);
    return { privateKey, publicKey };
  }

  getPublicKey = async (params: GetPublicKeyParams) => {
    if (params.algorithm && params.algorithm !== SigningAlgorithm.SECP256K1) {
      throw new Error(`getPublicKey: Unsupported signing algorithm: ${params.algorithm}`);
    }

    const { publicKey } = await this._getKeys(params);
    return publicKey;
  };
  sign = async (params: SignParams) => {
    if (params.algorithm && params.algorithm !== SigningAlgorithm.SECP256K1) {
      throw new Error(`sign: Unsupported signing algorithm: ${params.algorithm}`);
    }
    const { privateKey, publicKey } = await this._getKeys(params);

    const nobleSignature = sign(params.payload, privateKey);

    return {
      signature: {
        r: nobleSignature.r,
        s: nobleSignature.s,
        recovery: nobleSignature.recovery,
      },
      publicKey,
    };
  };
}

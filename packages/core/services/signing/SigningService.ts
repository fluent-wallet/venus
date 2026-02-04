import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { Address } from '@core/database/models/Address';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CoreError, TX_SIGN_ADDRESS_MISMATCH, TX_SIGN_MESSAGE_FAILED, TX_SIGN_TYPED_DATA_FAILED, TX_SIGN_UNSUPPORTED_NETWORK } from '@core/errors';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import type { EvmSignMessageParameters, EvmSignTypedDataParameters } from '@core/services/transaction/dappTypes';
import { VaultService } from '@core/services/vault';
import { HardwareSigner, SoftwareSigner } from '@core/signers';
import type { ISigner } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import { getBytes, hexlify, Signature, toUtf8Bytes, Wallet } from 'ethers';
import { inject, injectable } from 'inversify';

@injectable()
export class SigningService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(VaultService)
  private readonly vaultService!: VaultService;

  @inject(HardwareWalletRegistry)
  private readonly hardwareRegistry!: HardwareWalletRegistry;

  async getSigner(accountId: string, addressId: string): Promise<ISigner> {
    const account = await this.findAccount(accountId);
    const address = await this.findAddress(addressId);
    this.assertOwnership(account, address);

    const accountGroup = await account.accountGroup.fetch();
    const vault = await accountGroup.vault.fetch();

    if (vault.type === VaultType.BSIM) {
      return this.resolveHardwareSigner(account, address, vault.hardwareDeviceId ?? undefined);
    }
    if (vault.type === VaultType.HierarchicalDeterministic || vault.type === VaultType.PrivateKey) {
      const privateKey = await this.vaultService.getPrivateKey(vault.id, address.id);
      return new SoftwareSigner(privateKey);
    }

    throw new Error(`Vault type ${vault.type} does not support signing via SigningService.`);
  }

  async signPersonalMessage(params: { accountId: string; addressId: string; request: EvmSignMessageParameters; signal?: AbortSignal }): Promise<string> {
    const address = await this.findAddress(params.addressId);
    const network = await address.network.fetch();

    if (!network) {
      throw new Error('Address has no associated network.');
    }

    if (network.networkType !== NetworkType.Ethereum) {
      throw new CoreError({
        code: TX_SIGN_UNSUPPORTED_NETWORK,
        message: 'SigningService.signPersonalMessage is only supported for Ethereum networks.',
        context: { networkType: network.networkType },
      });
    }

    const expectedFrom = address.hex.toLowerCase();
    if (params.request.from.toLowerCase() !== expectedFrom) {
      throw new CoreError({
        code: TX_SIGN_ADDRESS_MISMATCH,
        message: 'SigningService.signPersonalMessage address mismatch.',
        context: { expectedFrom, from: params.request.from },
      });
    }

    const signer = await this.getSigner(params.accountId, params.addressId);

    const input = typeof params.request.message === 'string' ? params.request.message : params.request.message.raw;
    const isHexBytes = input.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(input);

    const messageBytes = isHexBytes ? getBytes(input) : toUtf8Bytes(input);
    const messageHex = hexlify(messageBytes);

    try {
      if (signer.type === 'software') {
        const wallet = new Wallet(signer.getPrivateKey());
        return wallet.signMessage(messageBytes);
      }

      const result = await signer.signWithHardware({
        derivationPath: signer.getDerivationPath(),
        chainType: signer.getChainType(),
        payload: {
          payloadKind: 'message',
          messageKind: 'personal',
          chainType: signer.getChainType(),
          message: messageHex,
        },
        signal: params.signal,
      });

      if (result.resultType === 'typedSignature') {
        return result.signature;
      }
      if (result.resultType === 'signature') {
        return Signature.from({ r: result.r, s: result.s, v: result.v ?? 27 }).serialized;
      }

      throw new Error(`Unsupported hardware resultType: ${String((result as any)?.resultType)}`);
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_SIGN_MESSAGE_FAILED,
        message: 'Failed to sign personal message.',
        cause: error,
        context: { signerType: signer.type },
      });
    }
  }

  async signTypedDataV4(params: { accountId: string; addressId: string; request: EvmSignTypedDataParameters; signal?: AbortSignal }): Promise<string> {
    const address = await this.findAddress(params.addressId);
    const network = await address.network.fetch();

    if (!network) {
      throw new Error('Address has no associated network.');
    }

    if (network.networkType !== NetworkType.Ethereum) {
      throw new CoreError({
        code: TX_SIGN_UNSUPPORTED_NETWORK,
        message: 'SigningService.signTypedDataV4 is only supported for Ethereum networks.',
        context: { networkType: network.networkType },
      });
    }

    const expectedFrom = address.hex.toLowerCase();
    if (params.request.from.toLowerCase() !== expectedFrom) {
      throw new CoreError({
        code: TX_SIGN_ADDRESS_MISMATCH,
        message: 'SigningService.signTypedDataV4 address mismatch.',
        context: { expectedFrom, from: params.request.from },
      });
    }

    const signer = await this.getSigner(params.accountId, params.addressId);
    // ethers signTypedData expects "types" WITHOUT EIP712Domain (it is derived from domain internally).
    const { EIP712Domain: _ignored, ...types } = params.request.typedData.types;

    try {
      if (signer.type === 'software') {
        const wallet = new Wallet(signer.getPrivateKey());
        return wallet.signTypedData(params.request.typedData.domain, types, params.request.typedData.message);
      }

      const result = await signer.signWithHardware({
        derivationPath: signer.getDerivationPath(),
        chainType: signer.getChainType(),
        payload: {
          payloadKind: 'message',
          messageKind: 'typedData',
          chainType: signer.getChainType(),
          domain: params.request.typedData.domain,
          types,
          message: params.request.typedData.message,
        },
        signal: params.signal,
      });

      if (result.resultType === 'typedSignature') {
        return result.signature;
      }
      if (result.resultType === 'signature') {
        return Signature.from({ r: result.r, s: result.s, v: result.v ?? 27 }).serialized;
      }

      throw new Error(`Unsupported hardware resultType: ${String((result as any)?.resultType)}`);
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_SIGN_TYPED_DATA_FAILED,
        message: 'Failed to sign typed data (v4).',
        cause: error,
        context: { signerType: signer.type },
      });
    }
  }
  private async findAccount(accountId: string): Promise<Account> {
    try {
      return await this.database.get<Account>(TableName.Account).find(accountId);
    } catch {
      throw new Error(`Account ${accountId} not found.`);
    }
  }

  private async findAddress(addressId: string): Promise<Address> {
    try {
      return await this.database.get<Address>(TableName.Address).find(addressId);
    } catch {
      throw new Error(`Address ${addressId} not found.`);
    }
  }

  private assertOwnership(account: Account, address: Address): void {
    if (address.account.id !== account.id) {
      throw new Error('Address does not belong to the provided account.');
    }
  }

  private async resolveHardwareSigner(account: Account, address: Address, hardwareId?: string): Promise<HardwareSigner> {
    const adapter = this.hardwareRegistry.get(HARDWARE_WALLET_TYPES.BSIM, hardwareId);
    if (!adapter) {
      throw new Error('No BSIM hardware wallet adapter is registered.');
    }

    const network = await address.network.fetch();
    if (!network) {
      throw new Error('Address has no associated network.');
    }

    const hardwareAccount = await adapter.deriveAccount(account.index, network.networkType);
    if (!hardwareAccount.derivationPath) {
      throw new Error('Hardware account derivation path is missing.');
    }

    if (hardwareAccount.chainType !== network.networkType) {
      throw new Error('Hardware account chain mismatch.');
    }

    return new HardwareSigner({
      wallet: adapter,
      derivationPath: hardwareAccount.derivationPath,
      chainType: hardwareAccount.chainType,
    });
  }
}

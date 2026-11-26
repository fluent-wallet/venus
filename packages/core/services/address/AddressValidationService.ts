import { ChainRegistry } from '@core/chains';
import { CHAIN_PROVIDER_NOT_FOUND, CoreError } from '@core/errors';
import type { ChainType } from '@core/types';
import { NetworkType } from '@core/types';
import type { Address as Base32Address } from 'cive';
import { decodeBase32Address, isAddress } from 'cive/utils';
import { inject, injectable } from 'inversify';
import { validate as isHexAddress } from 'ox/Address';

@injectable()
export class AddressValidationService {
  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  isValidAddress(params: { networkType: ChainType; addressValue: string }): boolean {
    const { networkType, addressValue } = params;
    if (!addressValue) return false;

    switch (networkType) {
      case NetworkType.Conflux:
        return isAddress(addressValue);
      case NetworkType.Ethereum:
        return isHexAddress(addressValue, { strict: false });
      default:
        return false;
    }
  }

  async isContractAddress(params: { networkType: ChainType; chainId: string; addressValue: string }): Promise<boolean> {
    const { networkType, chainId, addressValue } = params;
    if (!addressValue) return false;

    if (networkType === NetworkType.Conflux) {
      try {
        return decodeBase32Address({ address: addressValue as Base32Address }).type === 'contract';
      } catch {
        return false;
      }
    }

    if (networkType !== NetworkType.Ethereum) {
      return false;
    }

    const provider = this.chainRegistry.get(chainId, networkType);
    if (!provider) {
      throw new CoreError({
        code: CHAIN_PROVIDER_NOT_FOUND,
        message: 'Chain provider not found.',
        context: { chainId, networkType },
      });
    }

    const code = await provider.rpc.request('eth_getCode', [addressValue, 'latest']);
    if (typeof code !== 'string') {
      throw new Error('Invalid eth_getCode response type.');
    }

    return code !== '0x' && code !== '0x0' && code !== '0x00';
  }
}

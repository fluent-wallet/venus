import {BSIMError} from './errors';
import {BSIM} from './sdk';

export type GetPublicKeyAndAddressReturnType =
  | {
      coinType: 503;
      address?: never | undefined;
      index: number;
      key: string;
    }
  | {
      coinType: 60;
      /**
       * checksum address
       */
      address: string;
      index: number;
      key: string;
    };

/**
 * get the public key and address(only support ETH now)
 * @returns public key array list {@link GetPublicKeyAndAddressReturnType}
 * @throws {BSIMError} - error
 * @example
 * ```ts
 * const list = await getPublicKeyAndAddress()
 * list.forEach((item) => {
 *  if (item.coinType === 60) {
 *       console.log(item.address, item.index, item.key, item.coinType)
 *   } else {
 *      console.log( item.index, item.key, item.coinType)
 *   }
 })
 * ```
 */
export async function getPublicKeyAndAddress(): Promise<
  GetPublicKeyAndAddressReturnType[]
> {
  try {
    const result = await BSIM.getPublicKeyAndAddress();
    return result;
  } catch (e: unknown) {
    const error = e as BSIMError;
    throw new BSIMError(error.code, error.message);
  }
}

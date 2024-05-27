import { BSIMError, BSIM_ERRORS } from '@WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import methods from '@core/WalletCore/Methods';
import Plugins from '@core/WalletCore/Plugins';
import { checkDiffInRange } from '@core/WalletCore/Plugins/BlockNumberTracker';
import { NetworkType, VaultType, useCurrentAccount, useCurrentAddress, useCurrentNetwork, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import { useCallback, useRef } from 'react';

export class AddressNotMatchCurrent extends Error {
  constructor() {
    super('Address Not Match Current');
    this.message = 'Address Not Match Current';
  }
}

type SignTransactionParams = ITxEvm & { epochHeight: string };

type SignTransactionReturnType = (args: SignTransactionParams) => Promise<{ txRawPromise: Promise<string>; cancel: () => void }>;

/**
 * sign the transaction
 * @returns { SignTransactionReturnType }
 *
 * @example
 * const signTransaction = useSignTransaction();
 * const { txRawPromise, cancel } = signTransaction(tx);
 * const txRaw = await txRawPromise;
 */
export function useSignTransaction() {
  const currentNetwork = useCurrentNetwork()!;
  const currentAccount = useCurrentAccount()!;
  const currentVault = useVaultOfAccount(currentAccount?.id)!;
  const currentAddress = useCurrentAddress()!;

  const signTransaction = useCallback(
    async (tx: SignTransactionParams) => {
      if (currentVault?.type === VaultType.BSIM) {
        try {
          // sendTransaction has from field, but it is readonly, and it is only have by tx is signed otherwise it is null, so we need to pass the from address to signTransaction
          const [txRawPromise, cancel] = await Plugins.BSIM.signTransaction(tx.from, tx);
          return { txRawPromise, cancel };
        } catch (bsimError) {
          const code = (bsimError as { code: string })?.code;
          const message = (bsimError as { message: string })?.message;
          if (code === 'cancel') {
            // TODO: : ignore cancel error
            throw bsimError;
          } else {
            const errorMsg = BSIM_ERRORS[code?.toUpperCase()] || message || BSIM_ERRORS.default;
            throw new BSIMError(code, errorMsg);
          }
        }
      } else {
        const privateKey = await methods.getPrivateKeyOfAddress(currentAddress);
        const txRawPromise = Plugins.Transaction.signTransaction({
          network: currentNetwork,
          tx,
          privateKey,
          epochHeight: tx.epochHeight,
        });
        return {
          txRawPromise,
          cancel: () => {
            //
          },
        };
      }
    },
    [currentAddress, currentNetwork, currentVault],
  );

  return signTransaction;
}

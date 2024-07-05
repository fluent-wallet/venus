import type { Address } from '@core/database/models/Address';
import type { App } from '@core/database/models/App';
import type { Signature } from '@core/database/models/Signature';
import type { ProcessErrorType } from '@core/utils/eth';
import { notNull } from '@core/utils/rxjs';
import { BehaviorSubject, filter } from 'rxjs';
import type { AssetType } from '../Plugins/ReactInject';
import type { WalletTransactionType } from '../Plugins/Transaction/types';
import type { ITxEvm } from './../Plugins/Transaction/types';

export interface TransactionSubjectValue {
  txHash: string;
  txRaw: string;
  tx: ITxEvm;
  address: Address;
  signature?: Signature;
  app?: App;
  extraParams: Pick<WalletTransactionType, 'contractAddress'> & {
    to?: string;
    sendAt: Date;
    epochHeight?: string | null;
    errorType?: ProcessErrorType;
    err?: string;
    assetType?: AssetType;
    method: string;
  };
}

export const broadcastTransactionSubjectPush = new BehaviorSubject<TransactionSubjectValue | null>(null);

export const broadcastTransactionSubject = broadcastTransactionSubjectPush.pipe(filter((v) => v !== null));

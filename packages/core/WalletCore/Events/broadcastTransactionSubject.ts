import { BehaviorSubject, filter } from 'rxjs';
import { ITxEvm } from './../Plugins/Transaction/types';
import { type WalletTransactionType } from '../Plugins/Transaction/types';
import { ProcessErrorType } from '@core/utils/eth';
import { Address } from '@core/database/models/Address';
import { AssetType } from '../Plugins/ReactInject';
import { Signature } from '@core/database/models/Signature';
import { notNull } from '@core/utils/rxjs';
import { App } from '@core/database/models/App';

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

export const broadcastTransactionSubject = broadcastTransactionSubjectPush.pipe(filter(notNull));

import type { Address } from '@core/database/models/Address';
import type { App } from '@core/database/models/App';
import type { AssetType } from '@core/database/models/Asset';
import type { Signature } from '@core/database/models/Signature';
import type { Tx } from '@core/database/models/Tx';
import type { ProcessErrorType } from '@core/utils/eth';
import { BehaviorSubject, filter } from 'rxjs';
import type { ITxEvm } from './../Plugins/Transaction/types';
import type { WalletTransactionType } from '../Plugins/Transaction/types';

export interface SendTransactionParams {
  txHash: string;
  txRaw: string;
  tx: ITxEvm;
  address: Address;
  signature?: Signature;
  app?: App;
  extraParams: Pick<WalletTransactionType, 'contractAddress'> & {
    sendAt: Date;
    epochHeight?: string | null;
    errorType?: ProcessErrorType;
    err?: string;
    assetType?: AssetType;
    method: string;
  };
}

export interface SpeedUpTransactionParams {
  txHash: string;
  txRaw: string;
  tx: ITxEvm;
  signature: Signature;
  originTx: Tx;
  speedupAction: SpeedUpAction;
  sendAt: Date;
  epochHeight?: string | null;
}

export enum SpeedUpAction {
  SpeedUp = 'SpeedUp',
  Cancel = 'Cancel',
}
export enum TransactionActionType {
  Send = 'send',
  SpeedUp = 'speedUp',
}

export type TransactionSubjectValue =
  | {
      transactionType: TransactionActionType.Send;
      params: SendTransactionParams;
    }
  | {
      transactionType: TransactionActionType.SpeedUp;
      params: SpeedUpTransactionParams;
    };

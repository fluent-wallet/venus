import type { SignType } from '@core/database/models/Signature/type';

export { SignatureFilterOption, SignType } from '@core/database/models/Signature/type';

export type SignatureRecordAppSnapshot = {
  id: string;
  origin: string;
  icon: string | null;
};

export type SignatureRecordTxSnapshot = {
  id: string;
  method: string;
};

export type ISignatureRecord = {
  id: string;
  addressId: string;
  appId: string | null;
  txId: string | null;
  app: SignatureRecordAppSnapshot | null;
  tx: SignatureRecordTxSnapshot | null;
  signType: SignType;
  message: string | null;
  blockNumber: string;
  createdAt: number;
};

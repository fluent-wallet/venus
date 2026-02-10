import type { SignType } from '@core/database/models/Signature/type';

export { SignatureFilterOption, SignType } from '@core/database/models/Signature/type';

export type ISignatureRecord = {
  id: string;
  addressId: string;
  appId: string | null;
  txId: string | null;
  signType: SignType;
  message: string | null;
  blockNumber: string;
  createdAt: number;
};

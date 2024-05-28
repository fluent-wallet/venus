import { Address } from '@core/database/models/Address';
import { App } from '@core/database/models/App';
import { SignType } from '@core/database/models/Signature/type';
import { BehaviorSubject, filter } from 'rxjs';

export interface SignatureSubjectValue {
  address: Address;
  app?: App;
  signType: SignType;
  message?: string | null;
}

export const broadcastSignatureSubjectPush = new BehaviorSubject<SignatureSubjectValue | null>(null);

const notNull = <T>(value: T | null): value is T => value !== null;

export const broadcastSignatureSubject = broadcastSignatureSubjectPush.pipe(filter(notNull));

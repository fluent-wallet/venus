import { registerCodec } from '../registry';
import { confluxCorePaymentUriCodec } from './conflux-core';
import { ethereumPaymentUriCodec } from './ethereum';

registerCodec(ethereumPaymentUriCodec);
registerCodec(confluxCorePaymentUriCodec);

export const defaultPaymentUriCodecs = [ethereumPaymentUriCodec, confluxCorePaymentUriCodec];

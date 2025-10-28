import { registerCodec } from '../registry';
import { ethereumPaymentUriCodec } from './ethereum';
import { confluxCorePaymentUriCodec } from './conflux-core';

registerCodec(ethereumPaymentUriCodec);
registerCodec(confluxCorePaymentUriCodec);

export const defaultPaymentUriCodecs = [ethereumPaymentUriCodec, confluxCorePaymentUriCodec];

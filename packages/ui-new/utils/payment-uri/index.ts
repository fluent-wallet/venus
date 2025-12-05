import './codecs';

export {
  // test only
  __resetPaymentUriRegistryForTests,
  encodePaymentUri,
  getCodecById,
  getCodecForProtocol,
  listRegisteredCodecs,
  parsePaymentUri,
  registerCodec,
} from './registry';
export type {
  PaymentUriCodec,
  PaymentUriCodecParseResult,
  PaymentUriErrorCode,
  PaymentUriMetadata,
  PaymentUriNetworkHint,
  PaymentUriParams,
  PaymentUriPayload,
} from './types';
export { PaymentUriError } from './types';

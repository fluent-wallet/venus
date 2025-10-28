import './codecs';

export {
  registerCodec,
  parsePaymentUri,
  encodePaymentUri,
  getCodecById,
  getCodecForProtocol,
  listRegisteredCodecs,
  // test only
  __resetPaymentUriRegistryForTests,
} from './registry';

export { PaymentUriError } from './types';

export type {
  PaymentUriCodec,
  PaymentUriCodecParseResult,
  PaymentUriMetadata,
  PaymentUriNetworkHint,
  PaymentUriParams,
  PaymentUriPayload,
  PaymentUriErrorCode,
} from './types';

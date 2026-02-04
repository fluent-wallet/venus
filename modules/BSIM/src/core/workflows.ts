import { APDU_STATUS } from './errors';
import {
  buildDerivePrivateKey,
  buildExportPubkey,
  buildExportSeed,
  buildGetIccid,
  buildGetVersion,
  buildRestoreSeed,
  buildSignMessage,
  buildUpdateBpin,
  buildVerifyBpin,
  serializeCommand,
} from './params';
import { parseApduResponse } from './response';
import type { ApduCommand, ApduTransmit, HexString, PubkeyRecord, SignatureComponents } from './types';
import { extractSignature, normalizeHex, parsePubkeyChunk } from './utils';

export class ApduFlowError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? `APDU error ${code}`);
    this.name = 'ApduFlowError';
    this.code = code;
  }
}

type DispatchResult = ReturnType<typeof parseApduResponse>;

/**
 * dispatch a single APDU command and map the response into a structured result.
 */
const dispatchApdu = async (transmit: ApduTransmit, command: ApduCommand) => {
  const rawResponse = await transmit(serializeCommand(command));
  const parsed = parseApduResponse(rawResponse);

  if (parsed.status === 'error') {
    throw new ApduFlowError(parsed.code, parsed.message);
  }

  return parsed;
};

/**
 * Guard used when the card keeps streaming 0x6300 segments.
 */
const MAX_PUBKEY_SEGMENTS = 64;

const collectPubkeyRecords = (hex: string): PubkeyRecord[] => {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    return [];
  }

  const records: PubkeyRecord[] = [];
  let offset = 0;

  while (offset < normalized.length) {
    if (normalized.length - offset < 4) {
      throw new Error('Incomplete TLV chunk in pubkey stream');
    }

    const start = offset;
    offset += 2; // tag already validated by parsePubkeyChunk

    const lengthByteHex = normalized.slice(offset, offset + 2);
    if (lengthByteHex.length !== 2) {
      throw new Error('Missing TLV length byte');
    }
    const lengthIndicator = Number.parseInt(lengthByteHex, 16);
    if (!Number.isFinite(lengthIndicator)) {
      throw new Error('Invalid TLV length byte');
    }
    offset += 2;

    let length = lengthIndicator;
    if ((lengthIndicator & 0x80) !== 0) {
      const lengthOctets = lengthIndicator & 0x7f;
      const lengthHex = normalized.slice(offset, offset + lengthOctets * 2);
      if (lengthHex.length !== lengthOctets * 2) {
        throw new Error('Incomplete TLV extended length');
      }
      length = Number.parseInt(lengthHex, 16);
      offset += lengthOctets * 2;
    }

    const valueStart = offset;
    const valueEnd = valueStart + length * 2;
    const value = normalized.slice(valueStart, valueEnd);
    if (value.length !== length * 2) {
      throw new Error('Incomplete TLV value');
    }
    offset = valueEnd;

    const tlv = normalized.slice(start, offset);
    records.push(parsePubkeyChunk(tlv));
  }

  return records;
};

/**
 * 0x807C VERIFY BPIN and validate the result.
 */
export const verifyBpinFlow = async (transmit: ApduTransmit): Promise<void> => {
  const response = await dispatchApdu(transmit, buildVerifyBpin());

  if (response.status === 'pending') {
    throw new ApduFlowError(APDU_STATUS.PENDING, 'Unexpected pending status during BPIN verification');
  }
};

/**
 * 0x80AC SIGN MESSAGE and extract DER signature components.
 */
export const signMessageFlow = async (transmit: ApduTransmit, hash: string, coinType: number, index: number): Promise<SignatureComponents> => {
  const response = await dispatchApdu(transmit, buildSignMessage(hash, coinType, index));

  if (response.status !== 'success') {
    throw new ApduFlowError(APDU_STATUS.PENDING, 'Signature requires additional APDU exchange');
  }

  if (!response.payload) {
    throw new ApduFlowError('A000', 'Signature payload is empty');
  }

  return extractSignature(response.payload);
};

/**
 * 0x80C8 EXPORT PUBKEY LIST and stitch together multi-part results.
 */
export const exportPubkeysFlow = async (transmit: ApduTransmit): Promise<PubkeyRecord[]> => {
  let response = await dispatchApdu(transmit, buildExportPubkey(false));
  let buffer = '';
  let segments = 0;

  while (true) {
    buffer += response.payload;

    if (response.status === 'success') {
      return collectPubkeyRecords(buffer);
    }

    segments += 1;
    if (segments > MAX_PUBKEY_SEGMENTS) {
      throw new ApduFlowError(APDU_STATUS.PENDING, 'Exceeded maximum pubkey segments');
    }

    response = await dispatchApdu(transmit, buildExportPubkey(true));
  }
};

export const getVersionFlow = async (transmit: ApduTransmit): Promise<HexString> => {
  const response = await dispatchApdu(transmit, buildGetVersion());

  if (response.status !== 'success') {
    throw new ApduFlowError(APDU_STATUS.PENDING, 'Unexpected status while reading version');
  }

  return response.payload;
};

export const getIccidFlow = async (transmit: ApduTransmit): Promise<HexString> => {
  const response = await dispatchApdu(transmit, buildGetIccid());

  if (response.status !== 'success') {
    throw new ApduFlowError(APDU_STATUS.PENDING, 'Unexpected status while reading ICCID');
  }
  return response.payload;
};

/**
 * 0x80A8 DERIVE KEY and ensure completion.
 */
export const deriveKeyFlow = async (transmit: ApduTransmit, coinType: number, algorithm: number): Promise<void> => {
  const response = await dispatchApdu(transmit, buildDerivePrivateKey(coinType, algorithm));

  if (response.status !== 'success') {
    throw new ApduFlowError(APDU_STATUS.PENDING, 'Key derivation requires additional APDU exchange');
  }
};

/**
 * 0x807E UPDATE BPIN and return success flag.
 */
export const updateBpinFlow = async (transmit: ApduTransmit): Promise<'ok'> => {
  const response = await dispatchApdu(transmit, buildUpdateBpin());

  if (response.status === 'success') {
    return 'ok';
  }

  throw new ApduFlowError(APDU_STATUS.PENDING, 'BPIN update requires additional APDU exchange');
};

/**
 * 0x8074 EXPORT SEED and return encrypted payload.
 */

export const exportSeedFlow = async (transmit: ApduTransmit, key2Hex: string): Promise<HexString> => {
  const response = await dispatchApdu(transmit, buildExportSeed(key2Hex));

  if (response.status !== 'success') {
    throw new ApduFlowError(APDU_STATUS.PENDING, 'Seed export requires additional APDU exchange');
  }

  if (!response.payload) {
    throw new ApduFlowError('A000', 'Seed export payload is empty');
  }

  return response.payload;
};

/**
 * 0x8076 RESTORE SEED and ensure completion.
 */
export const restoreSeedFlow = async (transmit: ApduTransmit, key2Hex: string, cipherHex: string): Promise<'ok'> => {
  const response = await dispatchApdu(transmit, buildRestoreSeed(key2Hex, cipherHex));

  if (response.status === 'success') {
    return 'ok';
  }

  throw new ApduFlowError(APDU_STATUS.PENDING, 'Seed restore requires additional APDU exchange');
};

import type { ApduCommand } from './types';
import { asciiToHex, normalizeHex } from './utils';

export const BSIM_AID = 'A000000533C000FF860000000000054D';
export const ICCID_AID = 'A0000001510000';

const toHexByte = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`Value ${value} cannot be converted to hex byte`);
  }

  return value.toString(16).padStart(2, '0').toUpperCase();
};

const toHexWord = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error(`Coin type must be finite, received ${value}`);
  }
  const normalized = (value >>> 0).toString(16).padStart(8, '0');
  return normalized.toUpperCase();
};

const encodeLc = (data: string) => {
  const bytes = data.length / 2;
  return toHexByte(bytes);
};

const ensureAid = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (normalized.length === 0) {
    throw new Error('AID must not be empty');
  }
  return normalized;
};

export const buildSelectAid = (aid: string = BSIM_AID): ApduCommand => {
  const normalizedAid = ensureAid(aid);
  return {
    cla: '00',
    ins: 'A4',
    p1: '04',
    p2: '00',
    lc: encodeLc(normalizedAid),
    data: normalizedAid,
    le: '',
  };
};

export const buildVerifyBpin = (): ApduCommand => ({
  cla: '80',
  ins: '7C',
  p1: '00',
  p2: '00',
  lc: '00',
  data: '',
  le: '',
});

export const buildSetBpin = (asciiBpin: string): ApduCommand => {
  if (asciiBpin.length !== 6) {
    throw new Error('BPIN must be exactly 6 characters long');
  }
  const data = asciiToHex(asciiBpin);
  return {
    cla: '80',
    ins: '7A',
    p1: '00',
    p2: '00',
    lc: encodeLc(data),
    data,
    le: '',
  };
};
export const buildUpdateBpin = (): ApduCommand => ({
  cla: '80',
  ins: '7E',
  p1: '00',
  p2: '00',
  lc: '00',
  data: '',
  le: '',
});

export const buildDerivePrivateKey = (coinType: number, algorithm: number): ApduCommand => {
  const data = `${toHexWord(coinType)}${toHexByte(algorithm)}`;
  return {
    cla: '80',
    ins: 'A8',
    p1: '00',
    p2: '02',
    lc: encodeLc(data),
    data,
    le: '',
  };
};

export const buildSignMessage = (hash: string, coinType: number, index: number): ApduCommand => {
  const normalizedHash = normalizeHex(hash);
  if (normalizedHash.length === 0) {
    throw new Error('Message hash must not be empty');
  }
  const data = `${toHexWord(coinType)}${toHexByte(index)}${normalizedHash}`;
  return {
    cla: '80',
    ins: 'AC',
    p1: '00',
    p2: '00',
    lc: encodeLc(data),
    data,
    le: '',
  };
};

export const buildExportPubkey = (continueReading: boolean): ApduCommand => ({
  cla: '80',
  ins: 'C8',
  p1: '00',
  p2: continueReading ? '01' : '00',
  lc: '00',
  data: '',
  le: '',
});

export const buildGetVersion = (): ApduCommand => ({
  cla: '00',
  ins: 'CA',
  p1: '00',
  p2: '00',
  lc: '',
  data: '',
  le: '02',
});

export const buildGetIccid = (): ApduCommand => ({
  cla: '80',
  ins: 'CA',
  p1: '00',
  p2: '11',
  lc: '00',
  data: '',
  le: '',
});

export const serializeCommand = (command: ApduCommand): string => {
  const ensureByte = (value: string, label: string) => {
    const normalized = normalizeHex(value);
    if (normalized.length !== 2) {
      throw new Error(`${label} must be a single byte`);
    }
    return normalized;
  };

  const ensureOptionalField = (value: string, label: string) => {
    const normalized = normalizeHex(value);
    if (normalized.length === 0) {
      return normalized;
    }
    if (normalized.length !== 2 && normalized.length !== 4) {
      throw new Error(`${label} must be empty, 1 byte, or 2 bytes`);
    }
    return normalized;
  };

  const cla = ensureByte(command.cla, 'CLA');
  const ins = ensureByte(command.ins, 'INS');
  const p1 = ensureByte(command.p1, 'P1');
  const p2 = ensureByte(command.p2, 'P2');
  const data = normalizeHex(command.data);

  const normalizedLc = normalizeHex(command.lc);
  let lc = '';
  if (normalizedLc.length > 0) {
    if (normalizedLc.length !== 2) {
      throw new Error('LC must be a single byte');
    }
    lc = normalizedLc;
    const expectedLength = Number.parseInt(lc, 16);
    if (expectedLength !== data.length / 2) {
      throw new Error(`LC ${lc} does not match data length ${data.length / 2}`);
    }
  } else if (data.length > 0) {
    throw new Error('APDU command contains data but LC is missing');
  }

  const le = ensureOptionalField(command.le, 'LE');

  return `${cla}${ins}${p1}${p2}${lc}${data}${le}`;
};

import { Buffer } from 'buffer';
import BN from 'bn.js';
import randombytes from 'randombytes';

const isHexPrefixed = (str: string) => {
  if (typeof str !== 'string') {
    throw new Error("[is-hex-prefixed] value must be type 'string', is currently type " + typeof str + ', while checking isHexPrefixed.');
  }

  return str.slice(0, 2) === '0x';
};

export const stripHexPrefix = (str: string) => {
  if (typeof str !== 'string') {
    return str;
  }

  return isHexPrefixed(str) ? str.slice(2) : str;
};

export const randomHex = (size: number) => '0x' + randombytes(size).toString('hex');

export const randomInt = (a: number) => Math.floor(Math.random() * a);
/**
 * Returns a buffer filled with 0s.
 * @param bytes the number of bytes the buffer should be
 */
export const zeros = (bytes: number) => Buffer.allocUnsafe(bytes).fill(0);

/**
 * Pads a `String` to have an even length
 * @param {String} value
 * @return {String} output
 */
export function padToEven(value: string) {
  var a = value; // eslint-disable-line

  if (typeof a !== 'string') {
    throw new Error(`[@fluent-wallet/utils] while padding to even, value must be string, is currently ${typeof a}, while padToEven.`);
  }

  if (a.length % 2) {
    a = `0${a}`;
  }

  return a;
}

/**
 * Converts an `Number` to a `Buffer`
 * @param {Number} i
 * @return {Buffer}
 */
export function intToBuffer(i: number) {
  const hex = intToHex(i);

  return new Buffer(padToEven(hex.slice(2)), 'hex');
}

/**
 * Attempts to turn a value into a `Buffer`. As input it supports `Buffer`, `String`, `Number`, null/undefined, `BN` and other objects with a `toArray()` method.
 * @param v the value
 */
export const toBuffer = (v: string | Buffer | number | null | undefined | BN) => {
  if (!Buffer.isBuffer(v)) {
    if (Array.isArray(v)) {
      v = Buffer.from(v);
    } else if (typeof v === 'string') {
      if (isHexString(v)) {
        v = Buffer.from(padToEven(stripHexPrefix(v)), 'hex');
      } else {
        throw new Error(`Cannot convert string to buffer. toBuffer only supports 0x-prefixed hex strings and this string was given: ${v}`);
      }
    } else if (typeof v === 'number') {
      v = intToBuffer(v);
    } else if (v === null || v === undefined) {
      v = Buffer.allocUnsafe(0);
    } else if (BN.isBN(v)) {
      v = v.toArrayLike(Buffer);
    } else if (v.toArray) {
      // converts a BN to a Buffer
      v = Buffer.from(v.toArray());
    } else {
      throw new Error('invalid type');
    }
  }
  return v;
};

/**
 * Is the string a hex string.
 *
 * @method check if string is hex string of specific length
 * @param {String} value
 * @param {Number} length
 * @returns {Boolean} output the string is a hex string
 */
export function isHexString(value, length) {
  if (typeof value !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }

  if (length && value.length !== 2 + 2 * length) {
    return false;
  }

  return true;
}

/**
 * Interprets a `Buffer` as a signed integer and returns a `BN`. Assumes 256-bit numbers.
 * @param num Signed integer value
 */
export const fromSigned = (num) => new BN(num).fromTwos(256);

/**
 * Converts a `Buffer` into a `0x`-prefixed hex `String`.
 * @param buf `Buffer` object to convert
 */
export const bufferToHex = (buf) => {
  buf = toBuffer(buf);
  return '0x' + buf.toString('hex');
};

/**
 * Converts a `Buffer` to a `Number`.
 * @param buf `Buffer` object to convert
 * @throws If the input number exceeds 53 bits.
 */
export const bufferToInt = (buf) => new BN(toBuffer(buf)).toNumber();

/**
 * Adds "0x" to a given `String` if it does not already start with "0x".
 */
export const addHexPrefix = (str: string) => {
  if (typeof str !== 'string') {
    return str;
  }

  return isHexPrefixed(str) ? str : '0x' + str;
};

/**
 * Converts a `BN` to an unsigned integer and returns it as a `Buffer`. Assumes 256-bit numbers.
 * @param num
 */
export const toUnsigned = (num: number) => Buffer.from(num.toTwos(256).toArray());

/**
 * Converts a `Number` into a hex `String`
 * @param {Number} i
 * @return {String}
 */
export function intToHex(i: string | number) {
  const hex = String(i).toString(16); // eslint-disable-line
  return `0x${hex}`;
}

/**
 * Left Pads an `Array` or `Buffer` with leading zeros till it has `length` bytes.
 * Or it truncates the beginning if it exceeds.
 * @param msg the value to pad (Buffer|Array)
 * @param length the number of bytes the output should be
 * @param right whether to start padding form the left or right
 * @return (Buffer|Array)
 */
export const setLengthLeft = (msg: string, length: number, right = false) => {
  const buf = zeros(length);
  msg = toBuffer(msg) as Buffer;
  if (right) {
    if (msg.length < length) {
      msg.copy(buf);
      return buf;
    }
    return msg.slice(0, length);
  } else {
    if (msg.length < length) {
      msg.copy(buf, length - msg.length);
      return buf;
    }
    return msg.slice(-length);
  }
};

export const setLength = setLengthLeft;

/**
 * Right Pads an `Array` or `Buffer` with leading zeros till it has `length` bytes.
 * Or it truncates the beginning if it exceeds.
 * @param msg the value to pad (Buffer|Array)
 * @param length the number of bytes the output should be
 * @return (Buffer|Array)
 */
export const setLengthRight = (msg, length) => setLength(msg, length, true);

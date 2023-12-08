import { NativeModules } from 'react-native';

const { BSIMSDK } = NativeModules;
/**
 * all coin types for BSIM support
 */
export enum CFXCoinTypes {
  NAME = 'CONFLUX',
}

export enum CoinTypes {
  CONFLUX = 'CONFLUX',

  ETHEREUM = 'ETHEREUM',
  CALLISTO = 'CALLISTO',
  GOCHAIN = 'GOCHAIN',
  ETHEREUM_CLASSIC = 'ETHEREUM_CLASSIC',
  POA = 'POA',
  VECHAIN = 'VECHAIN',
  WANCHAIN = 'WANCHAIN',
  TRON = 'TRON',
  ICON = 'ICON',
  TOMO = 'TOMO',
  BITCOIN = 'BITCOIN',
  LITECOIN = 'LITECOIN',
  BITCOINCASH = 'BITCOINCASH',
  DASH = 'DASH',
  ZCOIN = 'ZCOIN',
  ZCASH = 'ZCASH',
  BINANCE = 'BINANCE',
  RIPPLE = 'RIPPLE',
  TEZOS = 'TEZOS',
  STELLAR = 'STELLAR',
  KIN = 'KIN',
  AION = 'AION',
  NIMIQ = 'NIMIQ',
  THUNDERTOKEN = 'THUNDERTOKEN',
  ATOM = 'ATOM',
  KAVA = 'KAVA',
  DOGECOIN = 'DOGECOIN',
  THETA = 'THETA',
  ONTOLOGY = 'ONTOLOGY',
  GROESTL = 'GROESTL',
  VIACOIN = 'VIACOIN',
  QTUM = 'QTUM',
  ZELCASH = 'ZELCASH',
  ZILLIQA = 'ZILLIQA',
  IOTEX = 'IOTEX',
  RAVEN = 'RAVEN',
  WAVES = 'WAVES',
  AETERNITY = 'AETERNITY',
  NEBULAS = 'NEBULAS',
  FIO = 'FIO',
  DECRED = 'DECRED',
  ALGORAND = 'ALGORAND',
  NANO = 'NANO',
  DIGIBYTE = 'DIGIBYTE',
  HARMONY = 'HARMONY',
  NEAR = 'NEAR',
  SOLANA = 'SOLANA',
  ELROND = 'ELROND',
  POLKADOT = 'POLKADOT',
  SMARTCHAIN = 'SMARTCHAIN',
  SMARTCHAINLEGACY = 'SMARTCHAINLEGACY',
  FILECOIN = 'FILECOIN',
}

export const BSIM_ERRORS: Record<string, string> = {
  default: 'Execution failed, unknown error.',
  A000: 'Execution failed, unknown error.',
  '6E00': 'CAL error',
  '6D00': 'INS error',
  '6700': 'length error',
  '6A80': 'data error',
  '6A84': 'Keystore space is full.',
  '6A86': 'P1 or P2 error.',
  '6A88': 'Authentication key not found / Decryption key not found / BPIN does not exist.',
  '6982': 'Insufficient permissions / Card activation authentication not performed / BPIN not verified.',
  '6983': 'Authentication method locked (Key locked).',
  '6984': 'Invalid random number / Random number not obtained.',
  '6985': 'Instruction invalid (already executed) / Insufficient execution conditions / Key value already exists.',
  '6300': 'Authentication failed.',
  '63C1': 'Authentication failed, 1 attempt remaining.',
  '63C2': 'Authentication failed, 2 attempt remaining.',
  '63C3': 'Authentication failed, 3 attempt remaining.',
  '63C4': 'Authentication failed, 4 attempt remaining.',
  '63C5': 'Authentication failed, 5 attempt remaining.',
  '63C6': 'Authentication failed, 6 attempt remaining.',
  '63C7': 'Authentication failed, 7 attempt remaining.',
  '63C8': 'Authentication failed, 8 attempt remaining.',
  '63C9': 'Authentication failed, 9 attempt remaining.',
  '63CA': 'Authentication failed, 10 attempt remaining.',
};

export class BSIMTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export interface BSIMPubKey {
  coinType: number;
  key: string;
  index: number;
}

interface BSIMSDKInterface {
  /**
   * Create BSIM SDK instance first then you can call other BSIM methods
   * @param appId string
   */
  create(): Promise<void>;

  /**
   * Create new pubkey from BSIM SDK
   * @param coinType CoinTypes
   */
  genNewKey(coinType: CoinTypes): Promise<string>;

  /**
   * Use BSIM SDK to sign message
   * @param msg string - sha3 hash message
   * @param index string
   */
  signMessage(msg: string, coinType: CoinTypes, index: number): Promise<{ code: string; message: string; r: string; s: string; v: string }>;

  /**
   * Get all Pubkey from BSIM SDK
   * @param cfxOnly boolean - only get cfx pubkey default true
   */
  getPubkeyList(cfxOnly: boolean): Promise<BSIMPubKey[]>;
  /**
   * bsim pubkey to eth pubkey
   * @param hexPubkey
   */
  pubkeyToECPubkey(hexPubkey: string): Promise<string>;

  closeChannel(): void;
  /**
   * get BSIM card version
   */
  getBSIMVersion(): Promise<string>;
  /**
   * get SDK version
   */
  getVersion(): Promise<string>;
  verifyBPIN(): Promise<string>;
}

export default BSIMSDK as BSIMSDKInterface;

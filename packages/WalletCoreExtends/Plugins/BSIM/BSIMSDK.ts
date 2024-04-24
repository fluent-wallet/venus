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
  default: 'BSIM error, unknown error.',
  cancel: 'User cancel the operation.',
  A000: 'BSIM error, unknown error. Error code: A000',
  '6E00': 'Failed to call BSIM. Error code: 6E00',
  '6D00': 'Failed to call BSIM. Error code: 6D00',
  '6700': 'Failed to call BSIM. Error code: 6700',
  '6A80': 'Failed to call BSIM. Error code: 6A80',
  '6A84': 'Failed to call BSIM. Error code: 6A84',
  '6A86': 'Failed to call BSIM. Error code: 6A86',
  '6A88': 'Wrong BPIN, unable to complete authentication. Error code:6A88',
  '6982': 'BSIM has not yet completed certification. Error code: 6982',
  '6983': 'BSIM Card is locked. Error code: 6983',
  '6984': 'Failed to call BSIM. Error code: 6984',
  '6985': 'BSIM error. Error code: 6985',
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

export const BSIM_SUPPORT_ACCOUNT_LIMIT = 127; // by now bism only support 127 accounts;

export class BSIMError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BSIMError';
    this.code = code;
  }
}

export class BSIMErrorEndTimeout extends BSIMError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'TimeoutError';
    this.code = code;
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
  signMessage(msg: string, coinTypeIndex: number, index: number): Promise<{ code: string; message: string; r: string; s: string; v: string }>;

  /**
   * Get all Pubkey from BSIM SDK
   */
  getPubkeyList(): Promise<BSIMPubKey[]>;
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
  /**
   * update BPIN
   */
  updateBPIN(): Promise<string>;

}

export default BSIMSDK as BSIMSDKInterface;
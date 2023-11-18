import { NativeModules } from 'react-native';

const { BSIMSDK } = NativeModules;
/**
 * all coin types for BSIM support
 */
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
  create(): void;

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
  signMessage(msg: string, coinType: CoinTypes, index: number): Promise<{code: string, message:string, r:string, s:string}>;

  /**
   * Get all Pubkey from BSIM SDK
   */
  getPubkeyList(): Promise<BSIMPubKey[]>;
  /**
   * bsim pubkey to eth pubkey
   * @param hexPubkey
   */
  pubkeyToECPubkey(hexPubkey: string): Promise<string>;

  

  closeChannel():void
  getBSIMVersion(): Promise<string>;
  getVersion():Promise<string>;
  verifyBPIN():Promise<string>;
  
}

export default BSIMSDK as BSIMSDKInterface;

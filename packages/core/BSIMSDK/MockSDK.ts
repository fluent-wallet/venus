import { NativeModules } from 'react-native';

const { BSIMMockSDK } = NativeModules;
/**
 * all coin types for BSIM support
 */
export enum CoinTypes {

  CONFLUX = "CONFLUX",
  
  ETHEREUM="ETHEREUM",
  CALLISTO="CALLISTO",
  GOCHAIN="GOCHAIN",
  ETHEREUM_CLASSIC="ETHEREUM_CLASSIC",
  POA="POA",
  VECHAIN="VECHAIN",
  WANCHAIN="WANCHAIN",
  TRON="TRON",
  ICON="ICON",
  TOMO="TOMO",
  BITCOIN="BITCOIN",
  LITECOIN="LITECOIN",
  BITCOINCASH="BITCOINCASH",
  DASH="DASH",
  ZCOIN="ZCOIN",
  ZCASH="ZCASH",
  BINANCE="BINANCE",
  RIPPLE="RIPPLE",
  TEZOS="TEZOS",
  STELLAR="STELLAR",
  KIN="KIN",
  AION="AION",
  NIMIQ="NIMIQ",
  THUNDERTOKEN="THUNDERTOKEN",
  ATOM="ATOM",
  KAVA="KAVA",
  DOGECOIN="DOGECOIN",
  THETA="THETA",
  ONTOLOGY="ONTOLOGY",
  GROESTL="GROESTL",
  VIACOIN="VIACOIN",
  QTUM="QTUM",
  ZELCASH="ZELCASH",
  ZILLIQA="ZILLIQA",
  IOTEX="IOTEX",
  RAVEN="RAVEN",
  WAVES="WAVES",
  AETERNITY="AETERNITY",
  NEBULAS="NEBULAS",
  FIO="FIO",
  DECRED="DECRED",
  ALGORAND="ALGORAND",
  NANO="NANO",
  DIGIBYTE="DIGIBYTE",
  HARMONY="HARMONY",
  NEAR="NEAR",
  SOLANA="SOLANA",
  ELROND="ELROND",
  POLKADOT="POLKADOT",
  SMARTCHAIN="SMARTCHAIN",
  SMARTCHAINLEGACY="SMARTCHAINLEGACY",
  FILECOIN="FILECOIN",
}

export interface BSIMPubKey {
  coinType: string;
  key: string;
  index: number;
}

export interface BSIMMessage {
  // /**
  //  * The coin type set conflux by default
  //  */
  coinType?:string
  index: number;
  msg: string;
}

interface BSIMMockSDKInterface {
  /**
   * Create BSIM SDK instance first then you can call other BSIM methods
   * @param appId string
   */
  createMockSDK(appId: string): void;

  /**
   * Create new pubkey from BSIM SDK
   * @param coinType CoinTypes
   */
  genNewKey(coinType: CoinTypes): Promise<BSIMPubKey>;

  /**
   * Use BSIM SDK to sign message
   * @param msg string
   * @param index string
   */
  signMessage(msg: string,coinType: CoinTypes, index: number): Promise<string>;

  /**
   * Use the BSIM SDK to batch sign message
   * @param messageList string message list json string
   * @example
   * batchSignMessage([{ msg, coinType: CoinTypes.CONFLUX, index }])
   */
  batchSignMessage(messageList: BSIMMessage[]): Promise<string[]>;
  /**
   * Get all Pubkey from BSIM SDK
   */
  getPubkeyList(): Promise<string>;
}

export default BSIMMockSDK as BSIMMockSDKInterface;

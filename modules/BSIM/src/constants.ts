import { CoinTypes } from './types';

export const SIGNATURE_ALGORITHMS = {
  ECDSA_SECP256K1: 0x01,
  ED25519: 0x02,
} as const;

export const DEFAULT_SIGNATURE_ALGORITHM = SIGNATURE_ALGORITHMS.ECDSA_SECP256K1;

type CoinTypeConfig = {
  index: number;
  defaultAlgorithm?: number;
};

export const COIN_TYPE_CONFIG: Record<CoinTypes, CoinTypeConfig> = {
  [CoinTypes.ETHEREUM]: { index: 60 },
  [CoinTypes.CONFLUX]: { index: 503 },
  [CoinTypes.CALLISTO]: { index: 820 },
  [CoinTypes.GOCHAIN]: { index: 6060 },
  [CoinTypes.ETHEREUM_CLASSIC]: { index: 61 },
  [CoinTypes.POA]: { index: 178 },
  [CoinTypes.VECHAIN]: { index: 818 },
  [CoinTypes.WANCHAIN]: { index: 5718350 },
  [CoinTypes.TRON]: { index: 195 },
  [CoinTypes.ICON]: { index: 74 },
  [CoinTypes.TOMO]: { index: 889 },
  [CoinTypes.BITCOIN]: { index: 0 },
  [CoinTypes.LITECOIN]: { index: 2 },
  [CoinTypes.BITCOINCASH]: { index: 145 },
  [CoinTypes.DASH]: { index: 5 },
  [CoinTypes.ZCOIN]: { index: 136 },
  [CoinTypes.ZCASH]: { index: 133 },
  [CoinTypes.BINANCE]: { index: 714 },
  [CoinTypes.RIPPLE]: { index: 144 },
  [CoinTypes.TEZOS]: { index: 1729 },
  [CoinTypes.STELLAR]: { index: 148 },
  [CoinTypes.KIN]: { index: 2017 },
  [CoinTypes.AION]: { index: 425 },
  [CoinTypes.NIMIQ]: { index: 242 },
  [CoinTypes.THUNDERTOKEN]: { index: 1001 },
  [CoinTypes.ATOM]: { index: 118 },
  [CoinTypes.KAVA]: { index: 459 },
  [CoinTypes.DOGECOIN]: { index: 3 },
  [CoinTypes.THETA]: { index: 500 },
  [CoinTypes.ONTOLOGY]: { index: 1024 },
  [CoinTypes.GROESTL]: { index: 17 },
  [CoinTypes.VIACOIN]: { index: 14 },
  [CoinTypes.QTUM]: { index: 2301 },
  [CoinTypes.ZELCASH]: { index: 19167 },
  [CoinTypes.ZILLIQA]: { index: 313 },
  [CoinTypes.IOTEX]: { index: 2112 },
  [CoinTypes.RAVEN]: { index: 175 },
  [CoinTypes.WAVES]: { index: 5741564 },
  [CoinTypes.AETERNITY]: { index: 457 },
  [CoinTypes.NEBULAS]: { index: 2718 },
  [CoinTypes.FIO]: { index: 235 },
  [CoinTypes.DECRED]: { index: 42 },
  [CoinTypes.ALGORAND]: { index: 283 },
  [CoinTypes.NANO]: { index: 165 },
  [CoinTypes.DIGIBYTE]: { index: 20 },
  [CoinTypes.HARMONY]: { index: 1023 },
  [CoinTypes.NEAR]: { index: 397 },
  [CoinTypes.SOLANA]: { index: 501, defaultAlgorithm: SIGNATURE_ALGORITHMS.ED25519 },
  [CoinTypes.ELROND]: { index: 508 },
  [CoinTypes.POLKADOT]: { index: 354, defaultAlgorithm: SIGNATURE_ALGORITHMS.ED25519 },
  [CoinTypes.SMARTCHAIN]: { index: 20000714 },
  [CoinTypes.SMARTCHAINLEGACY]: { index: 10000714 },
  [CoinTypes.FILECOIN]: { index: 461 },
} as const;

export const getCoinTypeIndex = (coin: CoinTypes): number => COIN_TYPE_CONFIG[coin].index;

export const getDefaultSignatureAlgorithm = (coin: CoinTypes): number => COIN_TYPE_CONFIG[coin].defaultAlgorithm ?? DEFAULT_SIGNATURE_ALGORITHM;

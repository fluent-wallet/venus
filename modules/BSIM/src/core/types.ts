export type HexString = string;

export type ApduCommand = {
  cla: string;
  ins: string;
  p1: string;
  p2: string;
  lc: string;
  data: string;
  le: string;
};

export type ApduTransmit = (payload: HexString) => Promise<HexString>;

export type SignatureComponents = {
  r: HexString;
  s: HexString;
};

export type PubkeyRecord = {
  coinType: number;
  index: number;
  alg: number;
  key: HexString;
};

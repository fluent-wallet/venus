export interface BsimQrPayload {
  v: number;
  version: string;
  seed_ct: string;
  iv: string; // 32 hex chars no prefix
  iccid_ct: string; // hex, even length no prefix
  pwd_tag: string; // 4 hex chars no prefix
}

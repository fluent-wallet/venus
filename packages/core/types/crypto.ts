export interface CryptoTool {
  encrypt(data: unknown, password: string): Promise<string>;
  decrypt<T = unknown>(encryptedDataString: string, password: string): Promise<T>;
  generateRandomString(byteCount?: number): string;
}

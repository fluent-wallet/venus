export interface ICryptoTool {
  encrypt(data: unknown, password?: string): Promise<string>;
  decrypt<T = unknown>(encryptedDataString: string, password?: string): Promise<T>;
  setGetPasswordMethod(getPasswordMethod: (() => string | null) | (() => Promise<string | null>)): void;
  getPassword(): Promise<string | null>;
  generateRandomString(byteCount?: number): string;
}

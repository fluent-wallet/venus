export type GetPassword = () => string | null | Promise<string | null>;

export interface PasswordProvider {
  getPassword(): Promise<string | null>;
}

export interface CryptoTool {
  encrypt(data: unknown, password?: string): Promise<string>;
  decrypt<T = unknown>(encryptedDataString: string, password?: string): Promise<T>;
  generateRandomString(byteCount?: number): string;
}

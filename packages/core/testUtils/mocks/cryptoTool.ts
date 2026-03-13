import type { CryptoTool } from '@core/types/crypto';

export function createStrictTestCryptoTool(): CryptoTool {
  return {
    async encrypt(data: unknown, password: string): Promise<string> {
      return JSON.stringify({ payload: data, password });
    },

    async decrypt<T = unknown>(encryptedString: string, password: string): Promise<T> {
      const parsed = JSON.parse(encryptedString) as { payload: T; password: string };
      if (parsed.password !== password) {
        throw new Error('Invalid password');
      }
      return parsed.payload;
    },

    generateRandomString(_byteCount?: number): string {
      return 'stub';
    },
  };
}

export function createPassthroughTestCryptoTool(): CryptoTool {
  return {
    async encrypt(data: unknown, _password: string): Promise<string> {
      return JSON.stringify({ payload: data });
    },

    async decrypt<T = unknown>(encryptedString: string, _password: string): Promise<T> {
      return (JSON.parse(encryptedString) as { payload: T }).payload;
    },

    generateRandomString(_byteCount?: number): string {
      return 'stub';
    },
  };
}

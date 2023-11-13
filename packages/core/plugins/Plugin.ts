export interface Plugin {
  name: string;
}

export interface CryptoToolPlugin extends Plugin {
  name: 'CryptoTool';
  encrypt(object: unknown): Promise<string>;
  decrypt<T = unknown>(encryptedDataString: string): Promise<T>;
}

import 'reflect-metadata';

import { CryptoToolServer } from './CryptoToolServer';

describe('CryptoToolServer', () => {
  it('encrypts/decrypts with explicit password', async () => {
    const tool = new CryptoToolServer();

    const original = { a: 1, b: 'x', nested: { ok: true } };
    const encrypted = await tool.encrypt(original, 'pw');
    const decrypted = await tool.decrypt<typeof original>(encrypted, 'pw');

    expect(decrypted).toEqual(original);

    const parsed = JSON.parse(encrypted) as { cipher: string; iv: string; salt: string };
    expect(typeof parsed.cipher).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.salt).toBe('string');
  });

  it('throws when password is omitted', async () => {
    const tool = new CryptoToolServer();
    await expect((tool as any).encrypt({ ok: true })).rejects.toThrow('CryptoToolServer: password is required');
  });

  it('throws when decrypt password is omitted', async () => {
    const tool = new CryptoToolServer();
    const ciphertext = JSON.stringify({ cipher: '00', iv: '00', salt: '00' });
    await expect((tool as any).decrypt(ciphertext)).rejects.toThrow('CryptoToolServer: password is required');
  });

  it('decrypts ciphertext with password', async () => {
    const tool = new CryptoToolServer();

    const plaintext = 'betray love blur install state spike brave nerve recipe captain dismiss you';
    const password = '12345678';
    const ciphertext =
      '{"iv":"06ee04369a5b575b74aaf278c3dea1ae","cipher":"602da76d782934687ae85704bf5fe13e08d5562c89206e1e463d772f6d05bb480f51a3c771fc98e80006b8c4a4b2e975f5602632620b4e6c9f40f3f94c47ecd6958729518afc05630c6f917cc417804a","salt":"ZrVLkLeKSK+Oh19MuFrn/g=="}';

    await expect(tool.decrypt<string>(ciphertext, password)).resolves.toBe(plaintext);
  });
});

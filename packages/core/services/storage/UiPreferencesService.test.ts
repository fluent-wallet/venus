import 'reflect-metadata';
import { Container } from 'inversify';
import { KeyValueStorageService } from './KeyValueStorageService';
import { UiPreferencesService } from './UiPreferencesService';

describe('UiPreferencesService', () => {
  it('returns defaults for empty storage', async () => {
    const container = new Container();
    const map = new Map<string, unknown>();

    container.bind(KeyValueStorageService).toConstantValue({
      get: async (key: string) => map.get(key),
      set: async (key: string, value: unknown) => {
        map.set(key, value);
      },
      remove: async (key: string) => {
        map.delete(key);
      },
    } as unknown as KeyValueStorageService);

    container.bind(UiPreferencesService).toSelf();
    const service = container.get(UiPreferencesService);

    await expect(service.getMode()).resolves.toBe('system');
    await expect(service.getTotalPriceVisible()).resolves.toBe(true);
    await expect(service.getLanguage()).resolves.toBe('system');
  });

  it('persists values and normalizes invalid ones', async () => {
    const container = new Container();
    const map = new Map<string, unknown>();

    container.bind(KeyValueStorageService).toConstantValue({
      get: async (key: string) => map.get(key),
      set: async (key: string, value: unknown) => {
        map.set(key, value);
      },
      remove: async (key: string) => {
        map.delete(key);
      },
    } as unknown as KeyValueStorageService);

    container.bind(UiPreferencesService).toSelf();
    const service = container.get(UiPreferencesService);

    await service.setMode('dark');
    await service.setTotalPriceVisible(false);
    await service.setLanguage('zh-Hant');

    await expect(service.getMode()).resolves.toBe('dark');
    await expect(service.getTotalPriceVisible()).resolves.toBe(false);
    await expect(service.getLanguage()).resolves.toBe('zh-Hant');

    map.set('mode', 'invalid');
    map.set('totalPriceVisible', 'nope');
    map.set('i18n-lang', 'xx');

    await expect(service.getMode()).resolves.toBe('system');
    await expect(service.getTotalPriceVisible()).resolves.toBe(true);
    await expect(service.getLanguage()).resolves.toBe('system');
  });
});

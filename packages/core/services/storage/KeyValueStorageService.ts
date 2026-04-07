import { CORE_IDENTIFIERS } from '@core/di';
import { inject, injectable } from 'inversify';

/**
 * Thin wrapper around the existing database-backed localStorage.
 */
export type KeyValueStorageAdapter = Readonly<{
  get: <T = unknown>(key: string) => Promise<T | null | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  remove: (key: string) => Promise<void>;
}>;

@injectable()
export class KeyValueStorageService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: unknown;

  private get adapter(): KeyValueStorageAdapter {
    const localStorage = (this.database as { localStorage?: KeyValueStorageAdapter } | null | undefined)?.localStorage;
    if (!localStorage) {
      throw new Error('Database.localStorage is not available. Ensure the app runtime initializes the database localStorage adapter.');
    }
    return localStorage;
  }

  async get<T = unknown>(key: string): Promise<T | null | undefined> {
    return this.adapter.get<T>(key);
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await this.adapter.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await this.adapter.remove(key);
  }
}

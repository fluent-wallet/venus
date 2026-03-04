import { inject, injectable } from 'inversify';
import { KeyValueStorageService } from './KeyValueStorageService';

export type UiThemeMode = 'light' | 'dark' | 'system';
export type UiLanguage = 'en' | 'zh-Hant' | 'system';

const MODE_KEY = 'mode';
const TOTAL_PRICE_VISIBLE_KEY = 'totalPriceVisible';
const I18N_LANG_KEY = 'i18n-lang';

@injectable()
export class UiPreferencesService {
  @inject(KeyValueStorageService)
  private readonly storage!: KeyValueStorageService;

  async getMode(): Promise<UiThemeMode> {
    const value = await this.storage.get<unknown>(MODE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
    return 'system';
  }

  async setMode(mode: UiThemeMode): Promise<void> {
    await this.storage.set(MODE_KEY, mode);
  }

  async getTotalPriceVisible(): Promise<boolean> {
    const value = await this.storage.get<unknown>(TOTAL_PRICE_VISIBLE_KEY);
    if (typeof value === 'boolean') return value;
    return true;
  }

  async setTotalPriceVisible(visible: boolean): Promise<void> {
    await this.storage.set(TOTAL_PRICE_VISIBLE_KEY, visible);
  }

  async getLanguage(): Promise<UiLanguage> {
    const value = await this.storage.get<unknown>(I18N_LANG_KEY);
    if (value === 'en' || value === 'zh-Hant' || value === 'system') return value;
    return 'system';
  }

  async setLanguage(language: UiLanguage): Promise<void> {
    await this.storage.set(I18N_LANG_KEY, language);
  }
}

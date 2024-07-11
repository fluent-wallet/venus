import 'i18next';
import type en from '../ui-new/assets/i18n/en.json';
import type zhHans from '../ui-new/assets/i18n/zh-Hans.json';
import type zhHant from '../ui-new/assets/i18n/zh-Hant.json';
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'en';
    resources: {
      en: typeof en;
      zhHans: typeof zhHans;
      zhHant: typeof zhHant;
    };
  }
}

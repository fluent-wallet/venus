import 'i18next';
import en from '../ui-new/assets/i18n/en.json';
import zhHans from '../ui-new/assets/i18n/zh-Hans.json';
import zhHant from '../ui-new/assets/i18n/zh-Hant.json';
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

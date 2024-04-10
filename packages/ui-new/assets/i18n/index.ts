import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zhHans from './zh-Hans.json';
import zhHant from './zh-Hant.json';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    'zh-Hans': { translation: zhHans },
    'zh-Hant': { translation: zhHant },
  },
  interpolation: {
    escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
  },
});

export default i18n;

import i18n, { resources } from '@assets/i18n';
import { getQueryClient, getUiPreferencesService } from '@service/core';
import { useQuery } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

export enum Lang {
  en = 'en',
  zhHant = 'zh-Hant',
  // zhHans = 'zh-Hans',
  system = 'system',
}

export const getSystemLang = () => {
  const locales = getLocales();
  const locale = locales[0];
  const languageTag = locale?.languageTag || Lang.en;
  if (['zh-TW', 'zh-HK', 'zh-MO'].includes(languageTag)) {
    return Lang.zhHant;
  }

  if (languageTag.startsWith(Lang.zhHant)) {
    return Lang.zhHant;
  }

  return Lang.en;
};

export const getI18nLangKey = () => ['preferences', 'i18n', 'lang'] as const;

const parseLang = (value: unknown): Lang => {
  if (value === Lang.system) return Lang.system;
  if (value === Lang.en) return Lang.en;
  if (value === Lang.zhHant) return Lang.zhHant;
  return Lang.system;
};

export const setI18nLanguage = (lang: Lang) => {
  const normalized = parseLang(lang);
  getQueryClient().setQueryData(getI18nLangKey(), normalized);
  void getUiPreferencesService()
    .setLanguage(normalized)
    .catch((error) => console.log(error));
};

export const useLang = (): Lang => {
  const prefs = getUiPreferencesService();
  const query = useQuery({
    queryKey: getI18nLangKey(),
    queryFn: async () => parseLang(await prefs.getLanguage()),
    initialData: Lang.system,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return parseLang(query.data);
};

export const useLanguage = (): Lang => {
  const lang = useLang();
  return lang === Lang.system ? getSystemLang() : lang;
};

export const useI18nInit = () => {
  const lang = useLang();
  const applied = useMemo(() => (lang === Lang.system ? getSystemLang() : lang), [lang]);

  useEffect(() => {
    if (i18n.language !== applied) {
      void i18n.changeLanguage(applied).catch((error) => console.log(error));
    }
  }, [applied]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (lang !== Lang.system) return;

      const sys = getSystemLang();
      if (i18n.language !== sys) {
        void i18n.changeLanguage(sys).catch((error) => console.log(error));
      }
    });

    return () => {
      sub.remove();
    };
  }, [lang]);
};

export const getI18n = () => {
  const stored = getQueryClient().getQueryData(getI18nLangKey());
  const normalized = parseLang(stored);
  const used = normalized === Lang.system ? getSystemLang() : normalized;
  return resources[used];
};

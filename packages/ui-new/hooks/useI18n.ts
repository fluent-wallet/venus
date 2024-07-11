import i18n, { resources } from '@assets/i18n';
import { getAtom, setAtom } from '@core/WalletCore/Plugins/ReactInject';
import database from '@core/database';
import { getLocales } from 'expo-localization';
import { atom, useAtomValue } from 'jotai';
import { useState } from 'react';
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

const storageKey = 'i18n-lang';
const _langAtom = atom<Lang>(Lang.en);
database.localStorage.get(storageKey).then((dbLang) => {
  if (dbLang === Lang.system || typeof dbLang === 'undefined') {
    const lang = getSystemLang();

    setAtom(langAtom, Lang.system);
    changeLangBySystem(lang);
    if (typeof dbLang === 'undefined') {
      database.localStorage.set(storageKey, Lang.system);
    }
  } else {
    setAtom(langAtom, dbLang as Lang);
    changeLangBySystem((dbLang as Lang) || Lang.system);
  }
});

const langAtom = atom(
  (get) => {
    const mode = get(_langAtom);
    return mode || Lang.system;
  },
  (_, set, update: Lang) => {
    set(_langAtom, update);
  },
);

function changeLang(updateLang: Lang, { updateDB = false, updateAtom = false }) {
  const supportLang = Object.values(Lang);
  let newLang = Lang.en;
  if (updateLang.startsWith(Lang.zhHant)) {
    newLang = Lang.zhHant;
  } else if (updateLang === Lang.system) {
    newLang = Lang.system;
  } else if (supportLang.includes(updateLang)) {
    newLang = updateLang;
  }

  if (newLang === Lang.system) {
    const sysLang = getSystemLang();
    i18n.changeLanguage(sysLang);
  } else {
    i18n.changeLanguage(newLang);
  }

  if (updateAtom) {
    setAtom(langAtom, newLang);
  }

  if (updateDB) {
    database.localStorage.set(storageKey, newLang);
  }
}

function changeLangBySystem(lang: Lang) {
  // change lang by system don't change atom and db
  changeLang(lang, { updateAtom: false, updateDB: false });
}

function handleSystemActive(nextAppState: string) {
  if (nextAppState === 'active' && getAtom(langAtom) === Lang.system) {
    const lang = getSystemLang();
    if (i18n.language !== lang) {
      changeLangBySystem(lang);
    }
  }
}

AppState.addEventListener('change', handleSystemActive);

export const setI18nLanguage = (lang: Lang) => {
  changeLang(lang, { updateAtom: true, updateDB: true });
};

export const useLang = () => useAtomValue(langAtom);
export const useSystemLang = () => {
  const [sysLang, setSysLang] = useState(() => getSystemLang());
  return sysLang;
};

export const useLanguage = () => {
  const lang = useLang();
  const systemLang = useSystemLang();

  return lang === Lang.system ? systemLang : lang;
};

export const getI18n = () => {
  const lange = getAtom(langAtom);
  const sysLang = getSystemLang();
  const usedLang = lange === Lang.system ? sysLang : lange;
  return resources[usedLang];
};

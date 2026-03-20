import {type Locales} from './i18n/i18n-types';
import {baseLocale, i18n, locales} from './i18n/i18n-util';
import {loadAllLocales} from './i18n/i18n-util.sync';

loadAllLocales();

let locale: Locales = 'en';
try {
  const currentLanguage = (globalThis as typeof globalThis & {
    i18next?: {
      language?: string;
    };
  }).i18next?.language ?? '';
  locale = currentLanguage as Locales;
  if (locale.startsWith('zh')) {
    locale = 'zh';
  }

  if (!locales.includes(locale)) {
    locale = baseLocale;
  }
} catch {
  /* empty */
}

const L = i18n()[locale];

export default L;

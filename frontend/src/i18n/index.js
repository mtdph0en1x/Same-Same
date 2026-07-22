import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import en from './en';
import es from './es';

const resources = {
  en,
  es,
};

let defaultLng = 'en';

if (Platform.OS === 'web' && typeof window !== 'undefined' && window.navigator) {
  const browserLang = window.navigator.language || window.navigator.userLanguage;
  if (browserLang && browserLang.toLowerCase().startsWith('es')) {
    defaultLng = 'es';
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

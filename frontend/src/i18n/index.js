import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import es from './es';
import ru from './ru';
import uk from './uk';

const resources = {
  en,
  es,
  ru,
  uk,
};

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const savedLang = await AsyncStorage.getItem('user-language');
      if (savedLang) {
        callback(savedLang);
        return;
      }
    } catch (e) {}

    // Auto-detect fallback
    let defaultLng = 'en';
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.navigator) {
      const browserLang = (window.navigator.language || window.navigator.userLanguage).toLowerCase();
      if (browserLang.startsWith('es')) defaultLng = 'es';
      else if (browserLang.startsWith('ru')) defaultLng = 'ru';
      else if (browserLang.startsWith('uk')) defaultLng = 'uk';
    }
    callback(defaultLng);
  },
  init: () => {},
  cacheUserLanguage: async (lng) => {
    try {
      await AsyncStorage.setItem('user-language', lng);
    } catch (e) {}
  }
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

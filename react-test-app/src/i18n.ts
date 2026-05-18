import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zh from './locales/zh.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

// Global t function setup with try-catch
const { t: _t } = i18n

window.t = (...args: Parameters<typeof _t>) => {
  try {
    return _t(...args)
  } catch (error) {
    if (typeof args[0] === 'string') {
      return args[0]
    }
    return ''
  }
}

export default i18n

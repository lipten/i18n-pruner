import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

declare global {
  interface Window {
    t: (...args: Parameters<typeof i18next.t>) => string
  }
}

// Custom useTranslate hook
export function useTranslate(namespace: string) {
  const { t } = useTranslation(namespace)
  
  return (key: string) => t(key) // i18n-pruner-ignore-line
}

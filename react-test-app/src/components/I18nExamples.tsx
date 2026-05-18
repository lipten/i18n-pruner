import { useTranslation, Trans } from 'react-i18next'
import { useTranslate } from '../hooks/useTranslate'

// Standard t function from useTranslation
export function HomePage() {
  const { t } = useTranslation()
  
  return (
    <div>
      <h1>{t('home.title')}</h1>
      <p>{t('home.subtitle')}</p>
      <button>{t('home.buttons.submit')}</button>
      <button>{t('home.buttons.cancel')}</button>
    </div>
  )
}

// Direct window.t usage
export function LegacyComponent() {
  return (
    <div>
      <p>{window.t('checkout.pay')}</p>
      <p>{window.t('checkout.total')}</p>
    </div>
  )
}

// Custom hook useTranslate
export function ProfilePage() {
  const tt = useTranslate('profile')
  
  return (
    <div>
      <span>{tt('name')}</span>
      <span>{tt('email')}</span>
    </div>
  )
}

// Trans component
export function TransExample() {
  return (
    <div>
      <Trans i18nKey="common.welcome" />
      <Trans i18nKey="user.profile" />
      <Trans i18nKey="common.dynamic" />
    </div>
  )
}

// Dynamic key example (should be flagged by audit)
export function DynamicExample() {
  const { t } = useTranslation()
  const channel = 'email'
  
  return (
    <div>
      {t(`${channel}.title`)}
    </div>
  )
}

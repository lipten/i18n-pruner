import { Trans } from 'react-i18next'

// Test file for i18n audit

// Standard t function
export function HomePage() {
  const title = t('home.title')
  const subtitle = t('home.subtitle')
  
  return (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <button>{t('home.buttons.submit')}</button>
      <button>{t('home.buttons.cancel')}</button>
    </div>
  )
}

// Window t function (direct)
export function LegacyComponent() {
  return (
    <div>
      {window.t('checkout.pay')}
      {window.t('checkout.total')}
    </div>
  )
}

// Window t via useTranslation destructuring
export function GlobalTSetup() {
  const { t: _t } = useTranslation()
  
  // 添加tryCatch 防止报错
  window.t = (...args) => {
    try {
      return _t(...args)
    } catch (error) {
      if (typeof args[0] === "string") {
        return args[0]
      }
      return ""
    }
  }
}

// Usage of window.t after setup
export function AfterSetupComponent() {
  return (
    <div>
      {window.t('global.success')}
      {window.t('global.error')}
      {window.t('global.loading')}
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

// Dynamic key (should be flagged)
export function DynamicExample() {
  const channel = 'email'
  
  return (
    <div>
      {t(`${channel}.title`)}
    </div>
  )
}

// Trans component
export function TransExample() {
  return (
    <div>
      <Trans i18nKey="common.welcome" />
      <Trans i18nKey="user.profile" />
      <Trans i18nKey={dynamicKey} /> {/* Dynamic - should be flagged */}
    </div>
  )
}

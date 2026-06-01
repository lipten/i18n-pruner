import { useTranslation } from 'react-i18next'
import { HomePage, LegacyComponent, ProfilePage, TransExample, DynamicExample, SpecialKeyExamples } from './components/I18nExamples'
import './i18n'

function App() {
  const { t, i18n } = useTranslation()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>{t('common.welcome')}</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => changeLanguage('en')}>EN</button>
        <button onClick={() => changeLanguage('zh')}>中文</button>
      </div>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
        <h2>Home Page (useTranslation)</h2>
        <HomePage />
      </section>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
        <h2>Legacy (window.t)</h2>
        <LegacyComponent />
      </section>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
        <h2>Profile (useTranslate)</h2>
        <ProfilePage />
      </section>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
        <h2>Trans Component</h2>
        <TransExample />
      </section>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
        <h2>Global t Usage</h2>
        <p>{window.t('global.success')}</p>
        <p>{window.t('global.error')}</p>
        <p>{window.t('global.loading')}</p>
      </section>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
        <h2>Special Keys</h2>
        <SpecialKeyExamples />
      </section>

      <section style={{ padding: '15px', background: '#ffe6e6', border: '1px solid #ff6666' }}>
        <h2>Dynamic Key (Risk)</h2>
        <DynamicExample />
      </section>
    </div>
  )
}

export default App

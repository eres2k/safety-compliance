import { useApp } from '../context/AppContext'

const frameworkStyles = {
  AT: {
    border: 'border-red-600',
    active: 'bg-red-600 text-white',
    inactive: 'bg-white text-gray-700 hover:bg-gray-50'
  },
  DE: {
    border: 'border-yellow-500',
    active: 'bg-yellow-500 text-black',
    inactive: 'bg-white text-gray-700 hover:bg-gray-50'
  },
  NL: {
    border: 'border-orange-500',
    active: 'bg-orange-500 text-white',
    inactive: 'bg-white text-gray-700 hover:bg-gray-50'
  }
}

export function Header() {
  const { framework, setFramework, language, setLanguage, t } = useApp()
  const styles = frameworkStyles[framework]

  return (
    <header className={`bg-white shadow-sm border-b-4 ${styles.border}`}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.appTitle}</h1>
            <p className="text-sm text-gray-600">{t.appSubtitle}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select language"
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="nl">Nederlands</option>
            </select>

            {/* Framework Selector */}
            <div className="flex rounded-lg overflow-hidden border" role="group" aria-label="Select legal framework">
              <button
                onClick={() => setFramework('AT')}
                className={`px-4 py-2 text-sm font-medium transition ${framework === 'AT' ? frameworkStyles.AT.active : frameworkStyles.AT.inactive}`}
                aria-pressed={framework === 'AT'}
              >
                AT ASchG
              </button>
              <button
                onClick={() => setFramework('DE')}
                className={`px-4 py-2 text-sm font-medium transition ${framework === 'DE' ? frameworkStyles.DE.active : frameworkStyles.DE.inactive}`}
                aria-pressed={framework === 'DE'}
              >
                DE DGUV
              </button>
              <button
                onClick={() => setFramework('NL')}
                className={`px-4 py-2 text-sm font-medium transition ${framework === 'NL' ? frameworkStyles.NL.active : frameworkStyles.NL.inactive}`}
                aria-pressed={framework === 'NL'}
              >
                NL Arbowet
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

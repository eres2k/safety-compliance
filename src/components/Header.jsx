import { useApp } from '../context/AppContext'

// Framework configuration with colors
const frameworks = {
  AT: {
    code: 'AT',
    name: 'Austria',
    lawName: 'ASchG',
    flag: '🇦🇹',
    colors: {
      bg: 'bg-red-600',
      bgHover: 'hover:bg-red-700',
      border: 'border-red-600',
      text: 'text-red-600',
      ring: 'ring-red-500/30'
    }
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    lawName: 'DGUV',
    flag: '🇩🇪',
    colors: {
      bg: 'bg-yellow-500',
      bgHover: 'hover:bg-yellow-600',
      border: 'border-yellow-500',
      text: 'text-yellow-500',
      ring: 'ring-yellow-500/30'
    }
  },
  NL: {
    code: 'NL',
    name: 'Netherlands',
    lawName: 'Arbowet',
    flag: '🇳🇱',
    colors: {
      bg: 'bg-orange-500',
      bgHover: 'hover:bg-orange-600',
      border: 'border-orange-500',
      text: 'text-orange-500',
      ring: 'ring-orange-500/30'
    }
  },
  WIKI: {
    code: 'WIKI',
    name: 'Wikipedia',
    lawName: 'Reference',
    flag: '📚',
    colors: {
      bg: 'bg-gray-600',
      bgHover: 'hover:bg-gray-700',
      border: 'border-gray-600',
      text: 'text-gray-600',
      ring: 'ring-gray-500/30'
    }
  }
}

// Theme toggle icon component
function ThemeIcon({ isDark }) {
  if (isDark) {
    // Moon icon
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>
    )
  }
  // Sun icon
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
    </svg>
  )
}

// Safety shield logo
function SafetyLogo() {
  return (
    <div className="relative">
      <div className="w-10 h-10 bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-whs-orange-500/30 group-hover:scale-105 transition-transform">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-whs-success-500 rounded-full border-2 border-white dark:border-whs-dark-900 flex items-center justify-center">
        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  )
}

export function Header() {
  const { framework, isDark, toggleTheme, t } = useApp()

  const currentFramework = frameworks[framework]

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-whs-dark-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-whs-dark-700 transition-colors duration-300">
      {/* Accent line */}
      <div className={`h-1 ${currentFramework.colors.bg} transition-colors duration-300`} />

      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo and Title */}
          <div className="flex items-center gap-4 group">
            <SafetyLogo />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="hidden sm:inline">{t.appTitle}</span>
                <span className="sm:hidden">WHS Navigator</span>
                <span className="text-xs font-normal px-2 py-0.5 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-600 dark:text-whs-orange-400 rounded-full">
                  EU
                </span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Framework Display (Read-only) */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${currentFramework.colors.bg} text-white shadow-md`}>
              <span className="text-lg">{currentFramework.flag}</span>
              <span className="text-sm font-semibold">{currentFramework.lawName}</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-whs-dark-800 hover:bg-gray-200 dark:hover:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-all"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <ThemeIcon isDark={isDark} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

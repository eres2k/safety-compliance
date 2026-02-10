import { useApp } from '../context/AppContext'

export function Footer({ onNavigate }) {
  const { t, framework, currentFrameworkColor } = useApp()

  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white dark:bg-whs-dark-900 border-t border-gray-200 dark:border-whs-dark-700 mt-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-whs-orange-500/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">WHS Navigator</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">EU Safety Compliance</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
              Workplace health and safety compliance navigator for Austria, Germany, and Netherlands.
            </p>
          </div>

          {/* Frameworks */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Supported Frameworks</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>🇦🇹</span>
                <span>Austria - ASchG (Arbeitnehmer:innenschutzgesetz)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>🇩🇪</span>
                <span>Germany - DGUV Regulations</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>🇳🇱</span>
                <span>Netherlands - Arbowet</span>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Legal Notice</h4>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>{t.footer.disclaimer}</p>
              <p>{t.footer.advice}</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-gray-200 dark:border-whs-dark-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                &copy; {currentYear} WHS Safety Compliance Navigator
              </p>
              <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                by{' '}
                <a
                  href="https://x.com/eeesener"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-whs-orange-500 hover:text-whs-orange-600 dark:text-whs-orange-400 dark:hover:text-whs-orange-300 font-medium"
                >
                  Erwin Esener @eeesener
                </a>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Currently viewing:
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-whs-dark-800 text-gray-700 dark:text-gray-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentFrameworkColor?.primary || '#f97316' }} />
                {currentFrameworkColor?.lawName || framework}
              </span>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('admin')}
                  className="text-xs text-gray-400 dark:text-gray-600 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors"
                  title="Admin Panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

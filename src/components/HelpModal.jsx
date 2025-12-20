import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

// Help icon for feature sections
function FeatureIcon({ type }) {
  const icons = {
    lawBrowser: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    complianceChecker: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    complianceDashboard: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    trainingResources: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    checklistTemplates: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    auditTrail: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    preventionTimeCalculator: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    penaltyLookup: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    glossary: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    officialSources: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    updates: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    countries: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    complexity: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    )
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 flex items-center justify-center text-white shadow-md">
      {icons[type] || icons.lawBrowser}
    </div>
  )
}

export function HelpModal({ isOpen, onClose }) {
  const { t, framework } = useApp()
  const help = t.help || {}

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const features = [
    { key: 'lawBrowser', icon: 'lawBrowser' },
    { key: 'complianceChecker', icon: 'complianceChecker' },
    { key: 'complianceDashboard', icon: 'complianceDashboard' },
    { key: 'trainingResources', icon: 'trainingResources' },
    { key: 'checklistTemplates', icon: 'checklistTemplates' },
    { key: 'auditTrail', icon: 'auditTrail' },
    { key: 'preventionTimeCalculator', icon: 'preventionTimeCalculator' },
    { key: 'penaltyLookup', icon: 'penaltyLookup' },
    { key: 'glossary', icon: 'glossary' }
  ]

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{help.title || 'Help & Guide'}</h2>
              <p className="text-white/80 text-sm">{help.subtitle || 'Learn how to use the WHS Safety Navigator'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Introduction */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {help.introTitle || 'Welcome'}
            </h3>
            <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
              {help.introText || 'The WHS Safety Navigator helps you navigate workplace health and safety regulations across Austria, Germany, and the Netherlands.'}
            </p>
          </div>

          {/* Official Sources Banner */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-4">
              <FeatureIcon type="officialSources" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                  {help.officialSourcesTitle || 'Official Law Sources'}
                </h3>
                <p className="text-green-800 dark:text-green-200 text-sm leading-relaxed">
                  {help.officialSourcesText || 'All legal texts displayed in this application are sourced from official government publications and regulatory authorities.'}
                </p>
              </div>
            </div>
          </div>

          {/* Update Frequency Banner */}
          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800">
            <div className="flex items-start gap-4">
              <FeatureIcon type="updates" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
                  {help.updateFrequencyTitle || 'Regular Updates'}
                </h3>
                <p className="text-purple-800 dark:text-purple-200 text-sm leading-relaxed">
                  {help.updateFrequencyText || 'Our database is updated every 14 days to ensure you always have access to the latest legal requirements and regulatory changes.'}
                </p>
              </div>
            </div>
          </div>

          {/* Supported Countries */}
          <div className="bg-gray-50 dark:bg-whs-dark-700/50 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <FeatureIcon type="countries" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {help.countriesTitle || 'Supported Countries'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 bg-white dark:bg-whs-dark-800 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600">
                    <span className="text-2xl">🇦🇹</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{help.countryAT || 'Austria'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">ASchG</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-whs-dark-800 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600">
                    <span className="text-2xl">🇩🇪</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{help.countryDE || 'Germany'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">DGUV / ArbSchG</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-whs-dark-800 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600">
                    <span className="text-2xl">🇳🇱</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{help.countryNL || 'Netherlands'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Arbowet</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-whs-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {help.featuresTitle || 'Features & Modules'}
            </h3>

            <div className="space-y-4">
              {features.map((feature) => (
                <div
                  key={feature.key}
                  className="bg-white dark:bg-whs-dark-700 rounded-xl p-4 border border-gray-200 dark:border-whs-dark-600 hover:border-whs-orange-300 dark:hover:border-whs-orange-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <FeatureIcon type={feature.icon} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {help.features?.[feature.key]?.title || feature.key}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {help.features?.[feature.key]?.description || ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Complexity Levels */}
          <div className="bg-gray-50 dark:bg-whs-dark-700/50 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <FeatureIcon type="complexity" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {help.complexityTitle || 'Content Complexity Levels'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {help.complexityText || 'Choose how you want to view legal content:'}
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-white dark:bg-whs-dark-800 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600">
                    <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">1</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{help.complexityLegal || 'Legal Text'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{help.complexityLegalDesc || 'Original legal language as published'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-white dark:bg-whs-dark-800 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600">
                    <span className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-sm">2</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{help.complexityWHS || 'WHS Summary'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{help.complexityWHSDesc || 'Key obligations and compliance requirements'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-white dark:bg-whs-dark-800 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600">
                    <span className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">3</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{help.complexitySimple || 'Simple Explanation'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{help.complexitySimpleDesc || 'Easy-to-understand explanation for everyone'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {help.tipsTitle || 'Tips'}
            </h3>
            <ul className="space-y-2">
              {(help.tips || [
                'Use the search function to quickly find specific regulations',
                'Bookmark important sections for quick access later',
                'Compare laws across countries to understand differences',
                'Use the complexity slider to adjust content to your needs'
              ]).map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="bg-gray-100 dark:bg-whs-dark-900 rounded-xl p-4 border border-gray-200 dark:border-whs-dark-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {help.disclaimer || 'This application is for informational purposes only. Always consult official sources and legal professionals for binding advice.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-whs-dark-900 border-t border-gray-200 dark:border-whs-dark-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {help.version || 'WHS Safety Navigator v2.0'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-whs-orange-500 hover:bg-whs-orange-600 text-white font-medium rounded-xl transition-colors"
            >
              {t.common?.close || 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpModal

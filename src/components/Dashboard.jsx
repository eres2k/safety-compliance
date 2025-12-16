import { useApp } from '../context/AppContext'
import { ModuleCard } from './ModuleCard'
import { getLawsStatistics } from '../services/euLawsDatabase'

// Module icons as SVG components for better styling
const moduleIcons = {
  lawBrowser: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  complianceChecker: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  quickReference: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  regulationLookup: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

// Accent colors for each module
const moduleColors = {
  lawBrowser: 'from-whs-orange-500 to-whs-orange-600',
  complianceChecker: 'from-whs-success-500 to-whs-success-600',
  quickReference: 'from-whs-yellow-500 to-whs-yellow-600',
  regulationLookup: 'from-purple-500 to-purple-600'
}

export function Dashboard({ onModuleSelect }) {
  const { t, framework, currentFrameworkColor } = useApp()

  // Get statistics for the hero section
  let stats = { totalLaws: 0, byType: [] }
  try {
    stats = getLawsStatistics(framework)
  } catch (e) {
    // Database not loaded yet, use defaults
  }

  const modules = [
    {
      id: 'complianceChecker',
      icon: moduleIcons.complianceChecker,
      title: t.modules.complianceChecker.title,
      description: t.modules.complianceChecker.description,
      gradient: moduleColors.complianceChecker,
      badge: 'Guidance'
    },
    {
      id: 'quickReference',
      icon: moduleIcons.quickReference,
      title: t.modules.quickReference.title,
      description: t.modules.quickReference.description,
      gradient: moduleColors.quickReference,
      badge: 'Calculators'
    },
    {
      id: 'regulationLookup',
      icon: moduleIcons.regulationLookup,
      title: t.modules.regulationLookup.title,
      description: t.modules.regulationLookup.description,
      gradient: moduleColors.regulationLookup,
      badge: 'Smart Search'
    }
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-whs-dark-800 to-whs-dark-900 dark:from-whs-dark-900 dark:to-black p-8 md:p-10">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern" />
        </div>

        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-whs-orange-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-whs-orange-500/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-whs-orange-500/20 rounded-full border border-whs-orange-500/30">
                <div className="w-2 h-2 bg-whs-orange-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-whs-orange-400">
                  {currentFrameworkColor?.name || 'EU'} Safety Regulations
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white">
                EU Workplace Safety{' '}
                <span className="text-gradient">Law Database</span>
              </h2>

              <p className="text-gray-400 max-w-xl">
                Comprehensive legal database with full-text workplace safety laws and regulations
                from Austria, Germany, and the Netherlands. Includes Wikipedia reference articles.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                <p className="text-3xl font-bold text-white">{stats.totalLaws || '86'}+</p>
                <p className="text-xs text-gray-400 mt-1">Laws</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                <p className="text-3xl font-bold text-white">3</p>
                <p className="text-xs text-gray-400 mt-1">Countries</p>
              </div>
              <div className="hidden sm:block bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                <p className="text-3xl font-bold text-whs-success-400">Full</p>
                <p className="text-xs text-gray-400 mt-1">Text</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Law Database - Main Feature */}
      <button
        onClick={() => onModuleSelect('lawBrowser')}
        className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 p-6 md:p-8 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-whs-orange-500/25 hover:-translate-y-1"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern" />
        </div>
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl md:text-3xl font-bold text-white">
                  {t.modules.lawBrowser.title}
                </h3>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium text-white">
                  {stats.totalLaws || '86'}+ Laws
                </span>
              </div>
              <p className="text-white/80 max-w-xl">
                {t.modules.lawBrowser.description}. Browse full-text laws with section navigation
                and search across all regulations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-white font-medium">
            <span>Browse Laws</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </button>

      {/* Additional Tools */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Additional Tools
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Compliance checking and reference tools
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {modules.map((module, index) => (
            <ModuleCard
              key={module.id}
              icon={module.icon}
              title={module.title}
              description={module.description}
              gradient={module.gradient}
              badge={module.badge}
              onClick={() => onModuleSelect(module.id)}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>

      {/* Framework Info */}
      <div className="bg-gradient-to-r from-whs-orange-500/5 to-transparent dark:from-whs-orange-500/10 rounded-2xl p-6 border border-whs-orange-500/10">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-whs-orange-500/10 rounded-xl">
            <svg className="w-6 h-6 text-whs-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              Currently viewing: {currentFrameworkColor?.lawName || framework} Framework
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You are browsing {currentFrameworkColor?.name || 'European'} workplace safety regulations.
              Switch frameworks using the selector in the header to access regulations from other countries.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

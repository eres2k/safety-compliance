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
  documentGenerator: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
  documentGenerator: 'from-whs-info-500 to-whs-info-600',
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
      id: 'lawBrowser',
      icon: moduleIcons.lawBrowser,
      title: t.modules.lawBrowser.title,
      description: t.modules.lawBrowser.description,
      gradient: moduleColors.lawBrowser,
      badge: `${stats.totalLaws}+ Laws`
    },
    {
      id: 'complianceChecker',
      icon: moduleIcons.complianceChecker,
      title: t.modules.complianceChecker.title,
      description: t.modules.complianceChecker.description,
      gradient: moduleColors.complianceChecker,
      badge: 'AI Powered'
    },
    {
      id: 'documentGenerator',
      icon: moduleIcons.documentGenerator,
      title: t.modules.documentGenerator.title,
      description: t.modules.documentGenerator.description,
      gradient: moduleColors.documentGenerator,
      badge: '6 Templates'
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
                Welcome to{' '}
                <span className="text-gradient">WHS Navigator</span>
              </h2>

              <p className="text-gray-400 max-w-xl">
                Access comprehensive workplace safety regulations from Austria, Germany, and the Netherlands.
                AI-powered compliance checking and document generation at your fingertips.
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
                <p className="text-3xl font-bold text-whs-success-400">AI</p>
                <p className="text-xs text-gray-400 mt-1">Powered</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Quick Access
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a module to get started
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
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

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
  )
}

// Accent colors for each module
const moduleColors = {
  lawBrowser: 'from-whs-orange-500 to-whs-orange-600',
  complianceChecker: 'from-whs-success-500 to-whs-success-600'
}

export function Dashboard({ onModuleSelect }) {
  const { t, framework, currentFrameworkColor } = useApp()

  // Get statistics for the hero section
  let stats = { totalLaws: 0, byType: [], lastUpdated: null, globalStats: null }
  try {
    stats = getLawsStatistics(framework)
  } catch (e) {
    // Database not loaded yet, use defaults
  }

  // Format the last updated date
  const formatLastUpdated = (dateStr) => {
    if (!dateStr) return null
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return null
    }
  }
  const lastUpdatedFormatted = formatLastUpdated(stats.lastUpdated)

  const modules = [
    {
      id: 'complianceChecker',
      icon: moduleIcons.complianceChecker,
      title: t.modules.complianceChecker.title,
      description: t.modules.complianceChecker.description,
      gradient: moduleColors.complianceChecker,
      badge: 'Guidance'
    }
  ]

  const newFeatureModules = [
    {
      id: 'complianceDashboard',
      icon: '📊',
      title: 'Compliance Dashboard',
      description: 'Track compliance status across all jurisdictions with visual overview',
      gradient: 'from-blue-500 to-blue-600',
      badge: 'New'
    },
    {
      id: 'trainingResources',
      icon: '🎓',
      title: 'Training Resources',
      description: 'Access mandatory and recommended safety training materials',
      gradient: 'from-purple-500 to-purple-600',
      badge: 'New'
    },
    {
      id: 'checklistTemplates',
      icon: '📋',
      title: 'Compliance Checklists',
      description: 'Pre-built checklists for site setup, audits, and inspections',
      gradient: 'from-teal-500 to-teal-600',
      badge: 'New'
    },
    {
      id: 'auditTrail',
      icon: '🕐',
      title: 'Audit Trail',
      description: 'View history of all compliance activities and reviews',
      gradient: 'from-gray-500 to-gray-600',
      badge: 'New'
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
                  Amazon MEU WHS - Delivery Last Mile Logistics
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Safety Compliance{' '}
                <span className="text-gradient">Navigator</span>
              </h2>

              <p className="text-gray-400 max-w-xl">
                Comprehensive workplace safety compliance platform for Delivery Last Mile Logistics operations
                across Austria, Germany, and the Netherlands.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                <p className="text-3xl font-bold text-white">{stats.globalStats?.total_documents || stats.totalLaws || '86'}+</p>
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
              {lastUpdatedFormatted && (
                <div className="hidden md:block bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                  <p className="text-lg font-bold text-whs-orange-400">{lastUpdatedFormatted}</p>
                  <p className="text-xs text-gray-400 mt-1">Last Updated</p>
                </div>
              )}
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

        <div className="grid md:grid-cols-2 gap-5">
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

      {/* New Features Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Compliance Management
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track, assess, and manage your safety compliance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {newFeatureModules.map((module, index) => (
            <button
              key={module.id}
              onClick={() => onModuleSelect(module.id)}
              className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${module.gradient} p-5 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{module.icon}</span>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium text-white">
                    {module.badge}
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-white mb-1">{module.title}</h4>
                <p className="text-white/80 text-sm line-clamp-2">{module.description}</p>
              </div>
            </button>
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
              You are browsing {currentFrameworkColor?.name || 'European'} workplace safety regulations
              for Amazon MEU WHS Delivery Last Mile Logistics operations.
              Switch frameworks using the selector in the header to access regulations from other countries.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

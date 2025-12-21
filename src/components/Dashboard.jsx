import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ModuleCard } from './ModuleCard'
import { getLawsStatistics, getRecentlyUpdatedLaws } from '../services/euLawsDatabase'
import { LessonsLearnedFeed } from './modules/LessonsLearnedFeed'

// Check if database was updated recently (within last 14 days)
function isRecentlyUpdated(dateStr) {
  if (!dateStr) return false
  try {
    const updateDate = new Date(dateStr)
    const now = new Date()
    const diffDays = (now - updateDate) / (1000 * 60 * 60 * 24)
    return diffDays <= 14
  } catch {
    return false
  }
}

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

  // Get statistics for the hero section (loaded asynchronously)
  const [stats, setStats] = useState({ totalLaws: 0, byType: [], lastUpdated: null, globalStats: null })
  const [recentlyUpdatedLaws, setRecentlyUpdatedLaws] = useState([])

  useEffect(() => {
    getLawsStatistics(framework)
      .then(data => setStats(data))
      .catch(() => {
        // Database not loaded yet, use defaults
        setStats({ totalLaws: 0, byType: [], lastUpdated: null, globalStats: null })
      })

    // Fetch recently updated laws
    getRecentlyUpdatedLaws(14, 5)
      .then(laws => setRecentlyUpdatedLaws(laws))
      .catch(() => setRecentlyUpdatedLaws([]))
  }, [framework])

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
  const recentlyUpdated = useMemo(() => isRecentlyUpdated(stats.lastUpdated), [stats.lastUpdated])

  // Calculate next update date (14 days from last update)
  const nextUpdateFormatted = useMemo(() => {
    if (!stats.lastUpdated) return null
    try {
      const lastUpdate = new Date(stats.lastUpdated)
      const nextUpdate = new Date(lastUpdate.getTime() + 14 * 24 * 60 * 60 * 1000)
      return nextUpdate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return null
    }
  }, [stats.lastUpdated])

  // Get UI section labels based on translations
  const getUILabels = () => {
    const labels = {
      en: {
        // Additional Tools section
        additionalToolsTitle: 'Additional Tools',
        additionalToolsSubtitle: 'Compliance checking and reference tools',
        // Badges
        badgeGuidance: 'Guidance',
        badgeCalculator: 'Calculator',
        badgeInteractive: 'Interactive',
        badgeChecklists: 'Checklists',
        badgeQuiz: 'Quiz',
        badgeReference: 'Reference',
        // Compliance Management section
        sectionTitle: 'Compliance Management',
        sectionSubtitle: 'Track, assess, and manage your safety compliance',
        warehouseFloor: { title: 'Warehouse Floor', description: 'Interactive warehouse floor plan with safety zones' },
        complianceChecklist: { title: 'Compliance Checklist', description: 'Pre-built checklists for audits and inspections' },
        quiz: { title: 'Safety Quiz', description: 'Test your knowledge of safety regulations' },
        bussgeld: { title: 'Penalties', description: 'Lookup fines for safety violations' },
        glossary: { title: 'Glossary', description: 'Safety terms and abbreviations' },
        // Safety Lessons Learned section
        lessonsLearnedTitle: 'Safety Lessons Learned',
        lessonsLearnedSubtitle: 'Weekly alerts and incident reports from EU safety agencies'
      },
      de: {
        // Additional Tools section
        additionalToolsTitle: 'Weitere Werkzeuge',
        additionalToolsSubtitle: 'Compliance-Prüfung und Nachschlagewerke',
        // Badges
        badgeGuidance: 'Leitfaden',
        badgeCalculator: 'Rechner',
        badgeInteractive: 'Interaktiv',
        badgeChecklists: 'Checklisten',
        badgeQuiz: 'Quiz',
        badgeReference: 'Nachschlagewerk',
        // Compliance Management section
        sectionTitle: 'Compliance-Management',
        sectionSubtitle: 'Verfolgen, bewerten und verwalten Sie Ihre Sicherheits-Compliance',
        warehouseFloor: { title: 'Lagerhalle', description: 'Interaktiver Lagerhallenplan mit Sicherheitszonen' },
        complianceChecklist: { title: 'Checklisten', description: 'Vorgefertigte Checklisten für Audits und Inspektionen' },
        quiz: { title: 'Wissensquiz', description: 'Testen Sie Ihr Wissen zu Arbeitsschutzvorschriften' },
        bussgeld: { title: 'Bußgeld', description: 'Bußgelder für Arbeitsschutzverstöße' },
        glossary: { title: 'Glossar', description: 'Fachbegriffe und Abkürzungen' },
        // Safety Lessons Learned section
        lessonsLearnedTitle: 'Sicherheitslektionen',
        lessonsLearnedSubtitle: 'Wöchentliche Warnungen und Unfallberichte von EU-Sicherheitsbehörden'
      },
      nl: {
        // Additional Tools section
        additionalToolsTitle: 'Extra Hulpmiddelen',
        additionalToolsSubtitle: 'Compliance-controle en naslagwerken',
        // Badges
        badgeGuidance: 'Richtlijn',
        badgeCalculator: 'Calculator',
        badgeInteractive: 'Interactief',
        badgeChecklists: 'Checklists',
        badgeQuiz: 'Quiz',
        badgeReference: 'Naslagwerk',
        // Compliance Management section
        sectionTitle: 'Compliancebeheer',
        sectionSubtitle: 'Volg, beoordeel en beheer uw veiligheidscompliance',
        warehouseFloor: { title: 'Magazijnvloer', description: 'Interactieve magazijnplattegrond met veiligheidszones' },
        complianceChecklist: { title: 'Checklists', description: 'Kant-en-klare checklists voor audits en inspecties' },
        quiz: { title: 'Kennisquiz', description: 'Test uw kennis van arbowetgeving' },
        bussgeld: { title: 'Boetes', description: 'Boetes voor overtredingen arbowetgeving' },
        glossary: { title: 'Woordenlijst', description: 'Vakbegrippen en afkortingen' },
        // Safety Lessons Learned section
        lessonsLearnedTitle: 'Veiligheidslessen',
        lessonsLearnedSubtitle: 'Wekelijkse waarschuwingen en incidentrapporten van EU-veiligheidsinstanties'
      }
    }
    const lang = t.appTitle?.includes('MEU') ? 'en' : (t.appSubtitle?.includes('Letzte') ? 'de' : (t.appSubtitle?.includes('Laatste') ? 'nl' : 'en'))
    return labels[lang] || labels.en
  }

  const uiLabels = getUILabels()

  const modules = [
    {
      id: 'complianceChecker',
      icon: moduleIcons.complianceChecker,
      title: t.modules.complianceChecker.title,
      description: t.help?.features?.complianceChecker?.description || t.modules.complianceChecker.description,
      gradient: moduleColors.complianceChecker,
      badge: uiLabels.badgeGuidance
    },
    {
      id: 'preventionTimeCalculator',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: t.help?.features?.preventionTimeCalculator?.title || (t.appSubtitle?.includes('Letzte') ? 'Präventionszeit-Rechner' : t.appSubtitle?.includes('Laatste') ? 'Preventietijd Calculator' : 'Prevention Time Calculator'),
      description: t.help?.features?.preventionTimeCalculator?.description || (t.appSubtitle?.includes('Letzte') ? 'Berechnung der Präventionszeit für Sicherheitsfachkräfte und Betriebsärzte' : t.appSubtitle?.includes('Laatste') ? 'Berekening van preventietijd voor veiligheidsdeskundigen en bedrijfsartsen' : 'Calculate required prevention time for safety specialists and occupational physicians'),
      gradient: 'from-emerald-500 to-emerald-600',
      badge: uiLabels.badgeCalculator
    }
  ]

  // Compliance modules - 5 separate buttons
  const complianceModules = [
    {
      id: 'warehouseVisualization',
      icon: '🏭',
      title: uiLabels.warehouseFloor.title,
      description: uiLabels.warehouseFloor.description,
      gradient: 'from-indigo-500 to-purple-600',
      badge: uiLabels.badgeInteractive
    },
    {
      id: 'checklistTemplates',
      icon: '📋',
      title: uiLabels.complianceChecklist.title,
      description: uiLabels.complianceChecklist.description,
      gradient: 'from-teal-500 to-teal-600',
      badge: uiLabels.badgeChecklists
    },
    {
      id: 'safetyQuiz',
      icon: '🎯',
      title: uiLabels.quiz.title,
      description: uiLabels.quiz.description,
      gradient: 'from-purple-500 to-purple-600',
      badge: uiLabels.badgeQuiz
    },
    {
      id: 'penaltyLookup',
      icon: '⚖️',
      title: uiLabels.bussgeld.title,
      description: uiLabels.bussgeld.description,
      gradient: 'from-red-500 to-red-600',
      badge: uiLabels.badgeReference
    },
    {
      id: 'glossary',
      icon: '📖',
      title: uiLabels.glossary.title,
      description: uiLabels.glossary.description,
      gradient: 'from-violet-500 to-violet-600',
      badge: uiLabels.badgeReference
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
                  MEU Safety Compliance - WHS
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

      {/* Database Update Status Banner - Compact */}
      {lastUpdatedFormatted && (
        <div className={`rounded-xl p-3 border ${recentlyUpdated ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800' : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${recentlyUpdated ? 'bg-green-100 dark:bg-green-800/30' : 'bg-blue-100 dark:bg-blue-800/30'}`}>
                <svg className={`w-4 h-4 ${recentlyUpdated ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium ${recentlyUpdated ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'}`}>
                  {t.dashboard?.lastUpdated || 'Updated'}: {lastUpdatedFormatted}
                </span>
                {recentlyUpdated && (
                  <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                    {t.dashboard?.recentlyUpdated || 'New'}
                  </span>
                )}
                {nextUpdateFormatted && (
                  <span className={`text-xs ${recentlyUpdated ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    • Next: {nextUpdateFormatted}
                  </span>
                )}
              </div>
            </div>

            {/* Updated Laws - Inline */}
            {recentlyUpdatedLaws.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs ${recentlyUpdated ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {t.dashboard?.updatedLaws || 'Changed'}:
                </span>
                {recentlyUpdatedLaws.slice(0, 4).map((law) => (
                  <button
                    key={law.id}
                    onClick={() => onModuleSelect('lawBrowser', { lawId: law.id, country: law.country })}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      recentlyUpdated
                        ? 'bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/60'
                        : 'bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60'
                    }`}
                  >
                    <span className="opacity-70">
                      {law.country === 'AT' ? '🇦🇹' : law.country === 'DE' ? '🇩🇪' : '🇳🇱'}
                    </span>
                    <span>{law.abbreviation || law.title?.split(' ')[0]}</span>
                  </button>
                ))}
                {recentlyUpdatedLaws.length > 4 && (
                  <span className={`text-xs ${recentlyUpdated ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    +{recentlyUpdatedLaws.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
              {uiLabels.additionalToolsTitle}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {uiLabels.additionalToolsSubtitle}
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

      {/* Compliance Management - 5 Module Cards */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {uiLabels.sectionTitle}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {uiLabels.sectionSubtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {complianceModules.map((module, index) => (
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

      {/* Lessons Learned Feed Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {uiLabels.lessonsLearnedTitle}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {uiLabels.lessonsLearnedSubtitle}
            </p>
          </div>
        </div>
        <LessonsLearnedFeed
          onSelectRegulation={(reg) => {
            onModuleSelect('lawBrowser', { searchQuery: reg.abbr })
          }}
        />
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
              for MEU WHS operations.
              Switch frameworks using the selector in the header to access regulations from other countries.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

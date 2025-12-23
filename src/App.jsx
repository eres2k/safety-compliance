import { useState, useEffect, useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { LawPreviewProvider } from './context/LawPreviewContext'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Dashboard } from './components/Dashboard'
import {
  LawBrowser,
  ComplianceChecker,
  TrainingResources,
  SafetyQuiz,
  ChecklistTemplates,
  PreventionTimeCalculator,
  PenaltyLookup,
  Glossary,
  WarehouseVisualization
} from './components/modules'
import { SafetyChatWidget, LawPreviewModal } from './components/ui'

// Initialize EU laws database on app load
import { initializeLawsDatabase } from './services/euLawsDatabase'

// URL utilities for deep linking
import { parseLawUrl, updateLawUrl, clearLawUrl } from './utils/lawUrl'

function AppContent() {
  const [activeModule, setActiveModule] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingLawNavigation, setPendingLawNavigation] = useState(null) // { lawId, country, searchQuery } for cross-module navigation
  const { isDark, framework } = useApp()

  // Handle module selection with optional navigation params
  const handleModuleSelect = (moduleId, options = {}) => {
    if (options.lawId || options.country || options.searchQuery) {
      setPendingLawNavigation(options)
    }
    setActiveModule(moduleId)
  }

  // Initialize database on mount - loads only the default framework (DE)
  // Other frameworks are loaded on-demand when user switches
  useEffect(() => {
    const init = async () => {
      try {
        // Only load DE (default framework) initially for faster startup
        // Other country databases will be loaded lazily when selected
        await initializeLawsDatabase('DE')
      } catch (error) {
        console.error('Failed to initialize laws database:', error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Navigate to a specific law in the LawBrowser
  const navigateToLaw = useCallback((lawId, country, section = null) => {
    setPendingLawNavigation({ lawId, country, section })
    setActiveModule('lawBrowser')
    // Update URL for shareable deep links
    updateLawUrl(lawId, country, section)
  }, [])

  // Clear pending navigation after LawBrowser has consumed it
  const clearPendingLawNavigation = useCallback(() => {
    setPendingLawNavigation(null)
  }, [])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event) => {
      const urlParams = parseLawUrl()
      if (urlParams.lawId && urlParams.country) {
        setPendingLawNavigation({
          lawId: urlParams.lawId,
          country: urlParams.country,
          section: urlParams.section
        })
        setActiveModule('lawBrowser')
      } else {
        setActiveModule(null)
        setPendingLawNavigation(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Parse URL on initial load to support deep linking
  useEffect(() => {
    if (!isLoading) {
      const urlParams = parseLawUrl()
      if (urlParams.lawId && urlParams.country) {
        setPendingLawNavigation({
          lawId: urlParams.lawId,
          country: urlParams.country,
          section: urlParams.section
        })
        setActiveModule('lawBrowser')
      }
    }
  }, [isLoading])

  const renderModule = () => {
    const onBack = () => {
      setActiveModule(null)
      clearLawUrl() // Clear URL params when going back to dashboard
    }

    switch (activeModule) {
      case 'lawBrowser':
        return (
          <LawBrowser
            onBack={onBack}
            initialLawId={pendingLawNavigation?.lawId}
            initialCountry={pendingLawNavigation?.country}
            initialSection={pendingLawNavigation?.section}
            initialSearchQuery={pendingLawNavigation?.searchQuery}
            onNavigationConsumed={clearPendingLawNavigation}
            onLawChange={(lawId, country, section) => updateLawUrl(lawId, country, section)}
          />
        )
      case 'complianceChecker':
        return <ComplianceChecker onBack={onBack} onNavigateToLaw={navigateToLaw} />
      case 'trainingResources':
        return <TrainingResources onBack={onBack} />
      case 'safetyQuiz':
        return <SafetyQuiz onBack={onBack} onSelectLaw={(lawRef) => navigateToLaw(lawRef.abbreviation, framework, lawRef.section)} />
      case 'checklistTemplates':
        return <ChecklistTemplates onBack={onBack} />
      case 'preventionTimeCalculator':
        return <PreventionTimeCalculator onBack={onBack} onNavigateToLaw={navigateToLaw} />
      case 'penaltyLookup':
        return <PenaltyLookup onBack={onBack} onNavigateToLaw={navigateToLaw} />
      case 'glossary':
        return <Glossary onBack={onBack} onNavigateToLaw={navigateToLaw} />
      case 'warehouseVisualization':
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 hover:bg-gray-50 dark:hover:bg-whs-dark-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <WarehouseVisualization
              onSelectRegulation={(reg) => {
                // Navigate to law browser with the selected regulation
                setPendingLawNavigation({ searchQuery: reg.abbr })
                setActiveModule('lawBrowser')
              }}
            />
          </div>
        )
      default:
        return <Dashboard onModuleSelect={handleModuleSelect} />
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-whs-dark-900">
        <div className="flex flex-col items-center gap-6">
          {/* Animated Logo */}
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-whs-orange-500/30 animate-pulse">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="absolute inset-0 bg-whs-orange-500/20 rounded-2xl animate-ping" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">WHS Navigator</h1>
            <p className="text-gray-400">Loading EU Safety Laws Database...</p>
          </div>

          {/* Loading bar */}
          <div className="w-48 h-1 bg-whs-dark-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-whs-orange-500 to-whs-orange-400 rounded-full animate-shimmer" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col bg-gray-50 dark:bg-whs-dark-900 transition-colors duration-300`}>
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid-pattern opacity-50 dark:opacity-30" />
        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-whs-orange-500/5 to-transparent dark:from-whs-orange-500/10" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-whs-orange-500/5 dark:bg-whs-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8">
          {renderModule()}
        </main>
        <Footer />
      </div>

      {/* Erwin Safety Chat Widget */}
      <SafetyChatWidget onNavigateToLaw={navigateToLaw} />

      {/* Global Law Preview Modal - shows on hover anywhere on the site */}
      <LawPreviewModal />
    </div>
  )
}

export function App() {
  return (
    <AppProvider>
      <LawPreviewProvider>
        <AppContent />
      </LawPreviewProvider>
    </AppProvider>
  )
}

export default App

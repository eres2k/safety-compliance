import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Dashboard } from './components/Dashboard'
import {
  LawBrowser,
  ComplianceChecker,
  QuickReference,
  RegulationLookup
} from './components/modules'

// Initialize EU laws database on app load
import { initializeLawsDatabase } from './services/euLawsDatabase'

function AppContent() {
  const [activeModule, setActiveModule] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isDark } = useApp()

  // Initialize database on mount
  useEffect(() => {
    const init = async () => {
      try {
        initializeLawsDatabase()
      } catch (error) {
        console.error('Failed to initialize laws database:', error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const renderModule = () => {
    const onBack = () => setActiveModule(null)

    switch (activeModule) {
      case 'lawBrowser':
        return <LawBrowser onBack={onBack} />
      case 'complianceChecker':
        return <ComplianceChecker onBack={onBack} />
      case 'quickReference':
        return <QuickReference onBack={onBack} />
      case 'regulationLookup':
        return <RegulationLookup onBack={onBack} />
      default:
        return <Dashboard onModuleSelect={setActiveModule} />
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
    </div>
  )
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App

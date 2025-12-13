import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Dashboard } from './components/Dashboard'
import {
  LawBrowser,
  ComplianceChecker,
  DocumentGenerator,
  QuickReference,
  RegulationLookup
} from './components/modules'

function AppContent() {
  const [activeModule, setActiveModule] = useState(null)

  const renderModule = () => {
    const onBack = () => setActiveModule(null)

    switch (activeModule) {
      case 'lawBrowser':
        return <LawBrowser onBack={onBack} />
      case 'complianceChecker':
        return <ComplianceChecker onBack={onBack} />
      case 'documentGenerator':
        return <DocumentGenerator onBack={onBack} />
      case 'quickReference':
        return <QuickReference onBack={onBack} />
      case 'regulationLookup':
        return <RegulationLookup onBack={onBack} />
      default:
        return <Dashboard onModuleSelect={setActiveModule} />
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {renderModule()}
      </main>
      <Footer />
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

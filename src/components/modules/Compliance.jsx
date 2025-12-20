import { useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { WarehouseVisualization } from './WarehouseVisualization'
import { ChecklistTemplates } from './ChecklistTemplates'
import { TrainingResources } from './TrainingResources'
import { PenaltyLookup } from './PenaltyLookup'
import { Glossary } from './Glossary'

/**
 * Compliance Module - Container with 5 sub-tabs
 * 1. Warehouse Floor (Interactive Floor Plan)
 * 2. Compliance Checklist
 * 3. Training
 * 4. Bussgeld (Penalties)
 * 5. Glossary
 */

const COMPLIANCE_TABS = [
  { id: 'warehouseFloor', icon: '🏭' },
  { id: 'complianceChecklist', icon: '📋' },
  { id: 'training', icon: '🎓' },
  { id: 'bussgeld', icon: '⚖️' },
  { id: 'glossary', icon: '📖' },
]

export function Compliance({ onBack, onSelectRegulation }) {
  const { t, language } = useApp()
  const [activeTab, setActiveTab] = useState('warehouseFloor')

  // Get tab labels based on current language
  const getTabLabel = useCallback((tabId) => {
    const labels = {
      warehouseFloor: {
        en: 'Warehouse Floor',
        de: 'Lagerhalle',
        nl: 'Magazijnvloer',
      },
      complianceChecklist: {
        en: 'Compliance Checklist',
        de: 'Compliance-Checkliste',
        nl: 'Compliance Checklist',
      },
      training: {
        en: 'Training',
        de: 'Schulung',
        nl: 'Training',
      },
      bussgeld: {
        en: 'Penalties',
        de: 'Bußgeld',
        nl: 'Boetes',
      },
      glossary: {
        en: 'Glossary',
        de: 'Glossar',
        nl: 'Woordenlijst',
      },
    }
    return labels[tabId]?.[language] || labels[tabId]?.en || tabId
  }, [language])

  // Handle regulation selection from Warehouse Floor
  const handleSelectRegulation = useCallback((reg) => {
    if (onSelectRegulation) {
      onSelectRegulation(reg)
    }
  }, [onSelectRegulation])

  // Render the active sub-module content (embedded, not with back button)
  const renderTabContent = () => {
    switch (activeTab) {
      case 'warehouseFloor':
        return (
          <WarehouseVisualization
            onSelectRegulation={handleSelectRegulation}
          />
        )
      case 'complianceChecklist':
        return <ChecklistTemplates embedded />
      case 'training':
        return <TrainingResources embedded />
      case 'bussgeld':
        return <PenaltyLookup embedded />
      case 'glossary':
        return <Glossary embedded />
      default:
        return null
    }
  }

  // Get section title and description
  const getSectionInfo = () => {
    const info = {
      en: {
        title: 'Compliance Center',
        description: 'Comprehensive compliance management for warehouse safety',
      },
      de: {
        title: 'Compliance-Center',
        description: 'Umfassendes Compliance-Management für Lagersicherheit',
      },
      nl: {
        title: 'Compliance Center',
        description: 'Uitgebreid compliancebeheer voor magazijnveiligheid',
      },
    }
    return info[language] || info.en
  }

  const sectionInfo = getSectionInfo()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 hover:bg-gray-50 dark:hover:bg-whs-dark-700 transition-colors"
            aria-label={t.common?.back || 'Back'}
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <span className="text-3xl">✅</span>
              {sectionInfo.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {sectionInfo.description}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-whs-dark-800 rounded-2xl border border-gray-200 dark:border-whs-dark-700 p-2">
        <div className="flex flex-wrap gap-2">
          {COMPLIANCE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 text-white shadow-lg shadow-whs-orange-500/25'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-whs-dark-700 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="hidden sm:inline">{getTabLabel(tab.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default Compliance

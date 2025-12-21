import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Select, Card, CardContent, FormattedAIResponse } from '../ui'
import { LoadingSpinner, DotsLoading } from '../ui/LoadingSpinner'
import { searchLaws, getAllLawsSync } from '../../services/euLawsDatabase'

const COMPANY_SIZES = ['1-10', '11-50', '51-100', '101-250', '250+']

// Amazon Delivery Station Types
const STATION_TYPES = {
  DS: { id: 'DS', icon: '🏢', key: 'deliveryStation' },
  SC: { id: 'SC', icon: '📦', key: 'sortCenter' },
  FLEX: { id: 'FLEX', icon: '🚗', key: 'flexStation' },
  SSD: { id: 'SSD', icon: '⚡', key: 'subSameDay' },
  RURAL: { id: 'RURAL', icon: '🌾', key: 'ruralStation' }
}

// Quick Compliance Templates for common scenarios
const QUICK_TEMPLATES = [
  { id: 'newLaunch', icon: '🚀', key: 'newStationLaunch', topics: ['riskAssessment', 'safetyTraining', 'firstAid', 'emergencyExits', 'ppeGeneral'] },
  { id: 'peakSeason', icon: '📈', key: 'peakSeasonReadiness', topics: ['workingHours', 'temporaryWorkers', 'ergonomics', 'workPace', 'firstAid'] },
  { id: 'pitAudit', icon: '🚜', key: 'pitSafetyAudit', topics: ['forkliftSafety', 'palletJacks', 'pitTraining', 'pedestrianSafety', 'batteryCharging'] },
  { id: 'driverSafety', icon: '🚚', key: 'driverSafetyCheck', topics: ['vanSafety', 'loadSecuring', 'drivingHours', 'routePlanning', 'customerDelivery'] },
  { id: 'newHire', icon: '👋', key: 'newHireOnboarding', topics: ['safetyInduction', 'newEmployees', 'ppeGeneral', 'emergencyExits', 'accidentReporting'] },
  { id: 'winterPrep', icon: '❄️', key: 'winterPreparation', topics: ['floorSafety', 'vanSafety', 'ppeGeneral', 'emergencyExits', 'firstAid'] }
]

// Seasonal alerts based on current month
const getSeasonalAlerts = (month) => {
  const alerts = []
  // Winter (Nov-Feb)
  if (month >= 10 || month <= 1) {
    alerts.push({ id: 'winter', icon: '❄️', key: 'winterHazards', priority: 'high', topics: ['floorSafety', 'vanSafety'] })
  }
  // Summer (Jun-Aug)
  if (month >= 5 && month <= 7) {
    alerts.push({ id: 'summer', icon: '☀️', key: 'summerHeat', priority: 'high', topics: ['workPace', 'restAreas'] })
  }
  // Peak Season (Oct-Dec)
  if (month >= 9 && month <= 11) {
    alerts.push({ id: 'peak', icon: '📈', key: 'peakSeasonAlert', priority: 'high', topics: ['workingHours', 'temporaryWorkers', 'ergonomics'] })
  }
  // Spring/Fall (transition periods)
  if ((month >= 2 && month <= 4) || (month >= 8 && month <= 9)) {
    alerts.push({ id: 'transition', icon: '🍂', key: 'seasonTransition', priority: 'medium', topics: ['floorSafety', 'vanSafety'] })
  }
  return alerts
}

// Smart topic suggestions based on station type
const STATION_TOPIC_SUGGESTIONS = {
  DS: ['vanSafety', 'loadSecuring', 'sortationSystems', 'ergonomics', 'workingHours'],
  SC: ['conveyorSafety', 'sortationSystems', 'forkliftSafety', 'rackingSafety', 'ergonomics'],
  FLEX: ['vanSafety', 'loadSecuring', 'routePlanning', 'customerDelivery', 'ppeGeneral'],
  SSD: ['workPace', 'ergonomics', 'vanSafety', 'loadSecuring', 'workingHours'],
  RURAL: ['vanSafety', 'routePlanning', 'drivingHours', 'customerDelivery', 'firstAid']
}

// Topic category icons for visual grouping
const CATEGORY_ICONS = {
  '_category_manual_handling': '📦',
  '_category_pit': '🚜',
  '_category_warehouse': '🏭',
  '_category_delivery': '🚚',
  '_category_ppe': '🦺',
  '_category_training': '📚',
  '_category_emergency': '🚨',
  '_category_work_org': '⏰',
  '_category_special': '👥',
  '_category_compliance': '✅',
  '_category_amazon': '📦'
}

// Priority badge component
const PriorityBadge = ({ priority, t }) => {
  const config = {
    high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: t?.complianceChecker?.priorityHigh || 'High' },
    medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: t?.complianceChecker?.priorityMedium || 'Medium' },
    low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: t?.complianceChecker?.priorityLow || 'Low' }
  }
  const c = config[priority] || config.medium
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// Compliance status indicators
const ComplianceIndicator = ({ status }) => {
  const statusConfig = {
    compliant: {
      color: 'bg-whs-success-500',
      text: 'Compliant',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    partial: {
      color: 'bg-whs-yellow-500',
      text: 'Partial',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    nonCompliant: {
      color: 'bg-whs-danger-500',
      text: 'Action Required',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    }
  }

  const config = statusConfig[status] || statusConfig.partial

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-medium ${config.color}`}>
      {config.icon}
      {config.text}
    </div>
  )
}

// Compliance History Manager
const HISTORY_KEY = 'compliance_check_history'
const MAX_HISTORY = 10

const getComplianceHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY)
    return history ? JSON.parse(history) : []
  } catch {
    return []
  }
}

const saveToHistory = (entry) => {
  try {
    const history = getComplianceHistory()
    const newEntry = {
      ...entry,
      id: Date.now(),
      timestamp: new Date().toISOString()
    }
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return []
  }
}

export function ComplianceChecker({ onBack, onNavigateToLaw }) {
  const { t, framework, currentFrameworkColor } = useApp()
  const { checkCompliance, isLoading } = useAI()

  const [companySize, setCompanySize] = useState('')
  const [stationType, setStationType] = useState('DS')
  const industry = 'Delivery Last Mile Logistics' // Fixed for Amazon MEU WHS
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState('')
  const [relatedLaws, setRelatedLaws] = useState([])
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('result')
  const [allLaws, setAllLaws] = useState([])
  const [showTemplates, setShowTemplates] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(true)

  // Get current month for seasonal alerts
  const currentMonth = new Date().getMonth()
  const seasonalAlerts = useMemo(() => getSeasonalAlerts(currentMonth), [currentMonth])

  // Get smart suggestions based on station type
  const smartSuggestions = useMemo(() => {
    return STATION_TOPIC_SUGGESTIONS[stationType] || STATION_TOPIC_SUGGESTIONS.DS
  }, [stationType])

  // Load all laws for law reference detection
  useEffect(() => {
    const laws = getAllLawsSync(framework)
    setAllLaws(laws)
  }, [framework])

  // Load compliance history
  useEffect(() => {
    setHistory(getComplianceHistory())
  }, [])

  const handleCheck = async () => {
    if (!companySize || !topic) {
      return
    }

    try {
      const stationInfo = STATION_TYPES[stationType]
      const stationLabel = t.complianceChecker?.stationTypes?.[stationInfo.key] || stationType
      const response = await checkCompliance(companySize, industry, topic, stationType, stationLabel)
      setResult(response)

      // Save to history
      const newHistory = saveToHistory({
        companySize,
        stationType,
        topic,
        framework
      })
      setHistory(newHistory)

      // Find related laws from our database (async)
      const searchResult = await searchLaws(topic, { country: framework, limit: 5 })
      setRelatedLaws(searchResult.results || [])

      // Hide templates after first check
      setShowTemplates(false)
    } catch (error) {
      setResult(t.api?.error || 'Failed to check compliance')
    }
  }

  const handleTemplateClick = (template) => {
    // Set first topic from template
    if (template.topics.length > 0 && t.topics) {
      const firstTopicKey = template.topics[0]
      const topicValue = t.topics[firstTopicKey]
      if (topicValue) {
        setTopic(topicValue)
      }
    }
    setShowTemplates(false)
  }

  const handleSuggestionClick = (suggestionKey) => {
    if (t.topics && t.topics[suggestionKey]) {
      setTopic(t.topics[suggestionKey])
      setShowSuggestions(false)
    }
  }

  const handleHistoryClick = (entry) => {
    setCompanySize(entry.companySize)
    setStationType(entry.stationType)
    if (t.topics) {
      // Find the topic in current translations
      const topicEntry = Object.entries(t.topics).find(([key, value]) =>
        value === entry.topic || key === entry.topic
      )
      if (topicEntry) {
        setTopic(topicEntry[1])
      }
    }
    setShowHistory(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Build topic options with category grouping (including Amazon-specific topics)
  const topicOptions = useMemo(() => {
    const options = []
    let currentCategory = null

    Object.entries(t.topics).forEach(([key, value]) => {
      if (key.startsWith('_category_')) {
        // This is a category header
        currentCategory = value
        options.push({
          value: '',
          label: value,
          isCategory: true,
          disabled: true
        })
      } else {
        // This is a topic
        const icon = currentCategory ? CATEGORY_ICONS[Object.keys(t.topics).find(k => t.topics[k] === currentCategory)] : ''
        options.push({
          value: value,
          label: `${icon ? '  ' : ''}${value}`,
          isCategory: false
        })
      }
    })

    return options
  }, [t.topics])

  const sizeOptions = COMPANY_SIZES.map(size => ({
    value: size,
    label: `${size} ${t.common.employees}`
  }))

  const stationTypeOptions = Object.entries(STATION_TYPES).map(([key, config]) => ({
    value: key,
    label: `${config.icon} ${t.complianceChecker?.stationTypes?.[config.key] || key}`
  }))

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {t.common.back}
        </button>

        <div className="flex items-center gap-3">
          {/* History Button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-whs-dark-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-whs-dark-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t.complianceChecker?.history || 'History'}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-whs-success-500/10 dark:bg-whs-success-500/20 rounded-full border border-whs-success-500/20">
            <div className="w-2 h-2 bg-whs-success-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-whs-success-600 dark:text-whs-success-400">
              {t.complianceChecker?.smartMode || 'Smart Mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-whs-success-500 to-whs-success-600 flex items-center justify-center shadow-lg shadow-whs-success-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.modules.complianceChecker.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {t.complianceChecker?.smartDescription || `Smart compliance checking for Amazon Delivery Stations - ${currentFrameworkColor?.lawName || framework}`}
            </p>
          </div>
        </div>
      </div>

      {/* Seasonal Alerts */}
      {seasonalAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {seasonalAlerts.map(alert => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                alert.priority === 'high'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              }`}
            >
              <span className="text-2xl">{alert.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {t.complianceChecker?.seasonalAlerts?.[alert.key] || alert.key}
                  </span>
                  <PriorityBadge priority={alert.priority} t={t} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {t.complianceChecker?.seasonalAlertDesc?.[alert.key] || 'Review seasonal safety requirements'}
                </p>
              </div>
              <button
                onClick={() => handleSuggestionClick(alert.topics[0])}
                className="px-3 py-1.5 bg-white dark:bg-whs-dark-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-whs-dark-600 transition-colors"
              >
                {t.complianceChecker?.checkNow || 'Check Now'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick Templates */}
      {showTemplates && !result && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.complianceChecker?.quickTemplates || 'Quick Compliance Templates'}
            </h3>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t.common.close}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUICK_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 hover:border-whs-orange-500 dark:hover:border-whs-orange-500 hover:shadow-md transition-all text-left group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">{template.icon}</span>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white block">
                    {t.complianceChecker?.templates?.[template.key] || template.key}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {template.topics.length} {t.complianceChecker?.topicsIncluded || 'topics'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.complianceChecker?.recentChecks || 'Recent Compliance Checks'}
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t.common.close}
            </button>
          </div>
          <div className="space-y-2">
            {history.slice(0, 5).map(entry => (
              <button
                key={entry.id}
                onClick={() => handleHistoryClick(entry)}
                className="w-full flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 hover:border-whs-orange-500 dark:hover:border-whs-orange-500 transition-all text-left"
              >
                <span className="text-xl">{STATION_TYPES[entry.stationType]?.icon || '🏢'}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 dark:text-white block truncate">
                    {entry.topic}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.companySize} {t.common.employees} • {entry.stationType} • {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <Card variant="glass" className="mb-6 animate-fade-in-up">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Station Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.complianceChecker?.stationType || 'Station Type'}
              </label>
              <select
                value={stationType}
                onChange={(e) => {
                  setStationType(e.target.value)
                  setShowSuggestions(true)
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-600 bg-white/50 dark:bg-whs-dark-800/50 backdrop-blur-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 transition-all"
              >
                {stationTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Station Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.common.stationSize}
              </label>
              <Select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                options={sizeOptions}
                placeholder={t.common.selectOption}
                variant="glass"
              />
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.common.topic}
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-whs-dark-600 bg-white/50 dark:bg-whs-dark-800/50 backdrop-blur-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 transition-all"
              >
                <option value="">{t.common.selectOption}</option>
                {(() => {
                  const groups = []
                  let currentGroup = null
                  let currentOptions = []

                  Object.entries(t.topics).forEach(([key, value]) => {
                    if (key.startsWith('_category_')) {
                      if (currentGroup) {
                        groups.push({ label: currentGroup, options: currentOptions })
                      }
                      currentGroup = value
                      currentOptions = []
                    } else {
                      currentOptions.push({ key, value })
                    }
                  })
                  if (currentGroup) {
                    groups.push({ label: currentGroup, options: currentOptions })
                  }

                  return groups.map((group, idx) => (
                    <optgroup key={idx} label={group.label}>
                      {group.options.map(opt => (
                        <option key={opt.key} value={opt.value}>
                          {opt.value}
                        </option>
                      ))}
                    </optgroup>
                  ))
                })()}
              </select>
            </div>
          </div>

          {/* Smart Suggestions */}
          {showSuggestions && !topic && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.complianceChecker?.suggestedFor || 'Suggested for'} {STATION_TYPES[stationType]?.icon} {t.complianceChecker?.stationTypes?.[STATION_TYPES[stationType]?.key] || stationType}:
              </label>
              <div className="flex flex-wrap gap-2">
                {smartSuggestions.map(suggestionKey => (
                  <button
                    key={suggestionKey}
                    onClick={() => handleSuggestionClick(suggestionKey)}
                    className="px-3 py-1.5 rounded-lg bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-400 text-sm font-medium hover:bg-whs-orange-200 dark:hover:bg-whs-orange-900/50 transition-colors"
                  >
                    {t.topics?.[suggestionKey] || suggestionKey}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleCheck}
            loading={isLoading}
            disabled={isLoading || !companySize || !topic}
            variant="success"
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="white" />
                {t.complianceChecker?.analyzing || 'Analyzing Compliance...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {t.complianceChecker?.checkButton || 'Check Compliance'}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card variant="glass" className="mb-6">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-whs-success-500/20 to-whs-success-600/20 flex items-center justify-center">
                  <LoadingSpinner size="lg" color="orange" />
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                {t.complianceChecker?.analyzingFor || 'Analyzing compliance for'} {STATION_TYPES[stationType]?.icon} {t.complianceChecker?.stationTypes?.[STATION_TYPES[stationType]?.key] || stationType}...
              </p>
              <DotsLoading />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !isLoading && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-whs-dark-700">
            <button
              onClick={() => setActiveTab('result')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'result'
                  ? 'border-whs-success-500 text-whs-success-600 dark:text-whs-success-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t.complianceChecker?.complianceReport || 'Compliance Report'}
            </button>
            {relatedLaws.length > 0 && (
              <button
                onClick={() => setActiveTab('laws')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'laws'
                    ? 'border-whs-success-500 text-whs-success-600 dark:text-whs-success-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t.common.relatedLaws} ({relatedLaws.length})
              </button>
            )}
          </div>

          {activeTab === 'result' && (
            <Card variant="elevated" className="overflow-hidden">
              <div className="bg-gradient-to-r from-whs-success-500 to-whs-success-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <span className="text-xl">{STATION_TYPES[stationType]?.icon || '🏢'}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{t.compliance.requirements}</h3>
                      <p className="text-white/70 text-sm">
                        {t.complianceChecker?.stationTypes?.[STATION_TYPES[stationType]?.key] || stationType} • {companySize} {t.common.employees} • {topic}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={handleCopy}
                    className="!bg-white/20 !text-white hover:!bg-white/30"
                  >
                    {copied ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {t.common.copied}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t.common.copy}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="max-h-[500px] overflow-y-auto bg-gray-50 dark:bg-whs-dark-800/50 p-4 rounded-xl border border-gray-100 dark:border-whs-dark-700">
                  <FormattedAIResponse
                    content={result}
                    onLawClick={onNavigateToLaw}
                    allLaws={allLaws}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'laws' && relatedLaws.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {t.complianceChecker?.clickLawToView || 'Click on any law to view it in the Law Browser'}
              </p>
              {relatedLaws.map((law, index) => (
                <Card
                  key={law.id || index}
                  variant="elevated"
                  className="hover:shadow-lg hover:border-whs-orange-500/50 transition-all cursor-pointer animate-fade-in-up group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => onNavigateToLaw?.(law.id, law.jurisdiction || framework)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-whs-success-500/10 to-whs-success-600/10 dark:from-whs-success-500/20 dark:to-whs-success-600/20 flex items-center justify-center flex-shrink-0 group-hover:from-whs-orange-500/20 group-hover:to-whs-orange-600/20 transition-colors">
                        <svg className="w-6 h-6 text-whs-success-500 group-hover:text-whs-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-whs-orange-600 dark:group-hover:text-whs-orange-400 transition-colors">
                              {law.name || law.title}
                            </h4>
                            <p className="text-sm text-whs-success-600 dark:text-whs-success-400 font-medium">
                              {law.reference || law.abbreviation || law.id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400">
                              {law.type || 'Law'}
                            </span>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-whs-orange-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                        {law.description && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {law.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !isLoading && (
        <Card variant="glass" className="text-center py-12">
          <CardContent>
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-whs-success-500/10 to-whs-success-600/10 dark:from-whs-success-500/20 dark:to-whs-success-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-whs-success-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t.complianceChecker?.readyToCheck || 'Ready to Check Compliance'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {t.complianceChecker?.emptyStateDesc || `Select your delivery station type, size and safety topic to get smart compliance guidance based on ${currentFrameworkColor?.lawName || framework} regulations.`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ComplianceChecker

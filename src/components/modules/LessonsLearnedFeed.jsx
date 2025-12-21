import { useState, useEffect, useCallback } from 'react'
import { fetchSafetyAlerts, clearSafetyAlertsCache } from '../../services/safetyRssService'

/**
 * LessonsLearnedFeed - Workplace Safety News
 * Fetches workplace safety news from agency RSS feeds (DGUV, AUVA, EU-OSHA, etc.)
 * Supports filtering by country (DE, AT, NL, EU), category, and severity
 * Falls back to sample data when feeds are unavailable
 */

// Safety alert sources configuration (EU-focused)
const SAFETY_SOURCES = {
  DGUV: {
    name: 'DE News',
    fullName: 'German Workplace Safety News',
    country: 'DE',
    flag: '🇩🇪',
    color: 'from-amber-500 to-amber-600',
    baseUrl: 'https://news.google.com',
  },
  AUVA: {
    name: 'AT News',
    fullName: 'Austrian Workplace Safety News',
    country: 'AT',
    flag: '🇦🇹',
    color: 'from-red-500 to-red-600',
    baseUrl: 'https://news.google.com',
  },
  ARBEIDSINSPECTIE: {
    name: 'NL News',
    fullName: 'Dutch Workplace Safety News',
    country: 'NL',
    flag: '🇳🇱',
    color: 'from-orange-500 to-orange-600',
    baseUrl: 'https://news.google.com',
  },
  EUOSHA: {
    name: 'EU News',
    fullName: 'European Workplace Safety News',
    country: 'EU',
    flag: '🇪🇺',
    color: 'from-blue-500 to-blue-600',
    baseUrl: 'https://news.google.com',
  },
}

// Severity levels for safety alerts
const SEVERITY_LEVELS = {
  critical: {
    label: 'Critical',
    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    icon: '🔴',
  },
  high: {
    label: 'High',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    icon: '🟠',
  },
  medium: {
    label: 'Medium',
    color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
    icon: '🟡',
  },
  low: {
    label: 'Low',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
    icon: '🟢',
  },
}

// Alert categories relevant to logistics
const ALERT_CATEGORIES = {
  forklift: { icon: '🚜', label: 'Forklift Operations' },
  manual_handling: { icon: '💪', label: 'Manual Handling' },
  falls: { icon: '⬇️', label: 'Falls & Falling Objects' },
  vehicle: { icon: '🚚', label: 'Vehicle Safety' },
  machinery: { icon: '⚙️', label: 'Machinery & Equipment' },
  hazmat: { icon: '☣️', label: 'Hazardous Substances' },
  fire: { icon: '🔥', label: 'Fire & Explosion' },
  electrical: { icon: '⚡', label: 'Electrical Hazards' },
  ergonomic: { icon: '🧘', label: 'Ergonomic Injuries' },
  ppe: { icon: '🦺', label: 'PPE Related' },
}

// Sample safety alerts (in production, these would come from API scraping)
const SAMPLE_ALERTS = [
  {
    id: 'alert-001',
    title: 'Forklift tip-over during ramp operations',
    summary: 'A forklift operator was seriously injured when the forklift tipped over while transitioning from a loading dock to a delivery truck. The ramp gradient exceeded safe limits.',
    source: 'DGUV',
    date: '2025-12-18',
    severity: 'critical',
    category: 'forklift',
    lessons: [
      'Always verify ramp gradient before driving onto truck beds',
      'Ensure dock levelers are properly deployed and locked',
      'Never exceed rated load capacity on inclines',
    ],
    relatedRegulations: ['DGUV Vorschrift 68', 'TRBS 2111'],
    logistics_relevance: 'critical',
  },
  {
    id: 'alert-002',
    title: 'Worker struck by falling pallet from height',
    summary: 'A warehouse worker sustained head injuries when a pallet dislodged from high-bay racking (5m height) while an adjacent forklift was retrieving stock.',
    source: 'AUVA',
    date: '2025-12-15',
    severity: 'high',
    category: 'falls',
    lessons: [
      'Implement exclusion zones during high-bay operations',
      'Regular racking inspection for beam connector integrity',
      'Mandatory hard hat use in all warehouse areas',
    ],
    relatedRegulations: ['ASchG §8', 'AM-VO §18'],
    logistics_relevance: 'critical',
  },
  {
    id: 'alert-003',
    title: 'Battery acid burn during charging station maintenance',
    summary: 'A maintenance technician suffered chemical burns when a forklift battery ruptured during routine maintenance. Inadequate PPE was the primary cause.',
    source: 'ARBEIDSINSPECTIE',
    date: '2025-12-12',
    severity: 'high',
    category: 'hazmat',
    lessons: [
      'Full face shields and acid-resistant aprons mandatory',
      'Never service batteries while connected to charger',
      'Emergency eyewash stations must be within 10 seconds reach',
    ],
    relatedRegulations: ['PGS 15', 'Arbobesluit Art. 4.1'],
    logistics_relevance: 'high',
  },
  {
    id: 'alert-004',
    title: 'Conveyor entanglement causes crush injury',
    summary: 'A package handler\'s clothing became entangled in conveyor rollers, resulting in arm injuries. The emergency stop was out of reach.',
    source: 'EUOSHA',
    date: '2025-12-10',
    severity: 'high',
    category: 'machinery',
    lessons: [
      'E-stops must be placed every 10 meters along conveyors',
      'Fitted clothing policy - no loose sleeves or jewelry',
      'Guard all nip points at conveyor tail pulleys',
    ],
    relatedRegulations: ['TRBS 2111', 'Arbobesluit Art. 7.7'],
    logistics_relevance: 'critical',
  },
  {
    id: 'alert-005',
    title: 'Musculoskeletal disorder from repetitive sorting',
    summary: 'Multiple workers at a sorting facility developed repetitive strain injuries (RSI) due to high-volume package handling without adequate rest breaks.',
    source: 'DGUV',
    date: '2025-12-08',
    severity: 'medium',
    category: 'ergonomic',
    lessons: [
      'Implement job rotation every 2 hours',
      'Provide ergonomic training for all handlers',
      'Install adjustable-height workstations',
    ],
    relatedRegulations: ['ArbSchG §5', 'ASR A3.4'],
    logistics_relevance: 'high',
  },
  {
    id: 'alert-006',
    title: 'Near-miss: Pedestrian struck by reversing delivery van',
    summary: 'A loading dock worker narrowly avoided being struck by a reversing delivery van. No spotter was present and reverse camera was malfunctioning.',
    source: 'AUVA',
    date: '2025-12-05',
    severity: 'medium',
    category: 'vehicle',
    lessons: [
      'Mandatory spotter for all reversing maneuvers',
      'Daily check of reverse cameras and sensors',
      'Designated pedestrian walkways in loading areas',
    ],
    relatedRegulations: ['ASchG §4', 'AStV §17'],
    logistics_relevance: 'critical',
  },
  {
    id: 'alert-007',
    title: 'Carbon monoxide buildup in enclosed loading bay',
    summary: 'Three workers experienced CO poisoning symptoms after diesel trucks idled inside a semi-enclosed loading bay for extended periods.',
    source: 'ARBEIDSINSPECTIE',
    date: '2025-12-01',
    severity: 'high',
    category: 'hazmat',
    lessons: [
      'Install CO monitors in all enclosed vehicle areas',
      'Limit idle time to 5 minutes maximum',
      'Ensure adequate ventilation - 10 air changes per hour',
    ],
    relatedRegulations: ['Arbowet Art. 3', 'ASR A3.6'],
    logistics_relevance: 'high',
  },
  {
    id: 'alert-008',
    title: 'Fire from overheated lithium battery during charging',
    summary: 'A small fire broke out when a damaged lithium-ion battery overheated during charging. Quick response prevented escalation.',
    source: 'DGUV',
    date: '2025-11-28',
    severity: 'high',
    category: 'fire',
    lessons: [
      'Inspect all batteries for damage before charging',
      'Maintain fire suppression near charging stations',
      'Never charge batteries unattended overnight',
    ],
    relatedRegulations: ['TRBS 3151', 'TRGS 510'],
    logistics_relevance: 'high',
  },
]

// Format relative date
function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return 'Last week'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString()
}

export function LessonsLearnedFeed({ onSelectRegulation, onViewAll }) {
  const [alerts, setAlerts] = useState(SAMPLE_ALERTS)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedSeverity, setSelectedSeverity] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null) // Country filter: 'DE', 'AT', 'NL', 'EU', or null for all
  const [expandedAlert, setExpandedAlert] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dataSource, setDataSource] = useState('sample') // 'live', 'cached', or 'sample'
  const [lastUpdated, setLastUpdated] = useState(null)

  // Fetch real incidents from RSS feeds on mount
  useEffect(() => {
    const loadAlerts = async () => {
      setIsLoading(true)
      try {
        const { alerts: rssAlerts, fromCache } = await fetchSafetyAlerts()
        if (rssAlerts && rssAlerts.length > 0) {
          setAlerts(rssAlerts)
          setDataSource(fromCache ? 'cached' : 'live')
          setLastUpdated(new Date())
        } else {
          // Fall back to sample data
          setAlerts(SAMPLE_ALERTS)
          setDataSource('sample')
        }
      } catch (error) {
        console.warn('Failed to fetch RSS alerts, using sample data:', error)
        setAlerts(SAMPLE_ALERTS)
        setDataSource('sample')
      }
      setIsLoading(false)
    }

    loadAlerts()
  }, [])

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (selectedCategory && alert.category !== selectedCategory) return false
    if (selectedSeverity && alert.severity !== selectedSeverity) return false
    // Country filter - match source's country
    if (selectedCountry) {
      const sourceConfig = SAFETY_SOURCES[alert.source]
      if (!sourceConfig || sourceConfig.country !== selectedCountry) return false
    }
    return true
  })

  // Refresh alerts from RSS feeds
  const refreshAlerts = useCallback(async () => {
    setIsLoading(true)
    try {
      // Clear cache to force fresh fetch
      clearSafetyAlertsCache()
      const { alerts: rssAlerts } = await fetchSafetyAlerts()
      if (rssAlerts && rssAlerts.length > 0) {
        setAlerts(rssAlerts)
        setDataSource('live')
        setLastUpdated(new Date())
      } else {
        // Fall back to sample data
        setAlerts(SAMPLE_ALERTS)
        setDataSource('sample')
      }
    } catch (error) {
      console.warn('Failed to refresh alerts:', error)
      setAlerts(SAMPLE_ALERTS)
      setDataSource('sample')
    }
    setIsLoading(false)
  }, [])

  // Alert card component
  const AlertCard = ({ alert, isExpanded, onToggle }) => {
    const source = SAFETY_SOURCES[alert.source]
    const severity = SEVERITY_LEVELS[alert.severity]
    const category = ALERT_CATEGORIES[alert.category]

    return (
      <div className={`border rounded-xl overflow-hidden transition-all ${severity.color.split(' ')[0]} ${severity.color.split(' ')[1]}`}>
        {/* Alert Header */}
        <button
          onClick={onToggle}
          className="w-full p-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Category Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white dark:bg-whs-dark-800 flex items-center justify-center shadow-sm">
              <span className="text-xl">{category?.icon || '⚠️'}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${severity.color}`}>
                  {severity.icon} {severity.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatRelativeDate(alert.date)}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {source?.flag} {source?.name}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                {alert.title}
              </h4>
              {!isExpanded && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {alert.summary}
                </p>
              )}
            </div>

            {/* Expand indicator */}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-0 border-t border-current/10">
            {/* Full Summary */}
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {alert.summary}
            </p>

            {/* Key Lessons */}
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <span>💡</span> Key Lessons Learned
              </h5>
              <ul className="space-y-1">
                {alert.lessons.map((lesson, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {lesson}
                  </li>
                ))}
              </ul>
            </div>

            {/* Related Regulations */}
            <div>
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <span>📋</span> Related Regulations
              </h5>
              <div className="flex flex-wrap gap-2">
                {alert.relatedRegulations.map((reg, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectRegulation && onSelectRegulation({ abbr: reg })}
                    className="px-3 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-whs-orange-500 hover:text-whs-orange-600 dark:hover:text-whs-orange-400 transition-colors"
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>

            {/* Logistics Relevance */}
            {alert.logistics_relevance && (
              <div className="mt-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-2">
                <span>🚜</span>
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Logistics Relevance:</strong> {alert.logistics_relevance.toUpperCase()}
                </span>
              </div>
            )}

            {/* Source Link for news items */}
            {alert.sourceUrl && alert.isRealIncident && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <span>✓</span> Official source: {source?.name || alert.source}
                </span>
                <a
                  href={alert.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-whs-orange-600 dark:text-whs-orange-400 hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Source
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-whs-dark-800 rounded-2xl border border-gray-200 dark:border-whs-dark-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-red-500 to-orange-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📰</span>
            <div>
              <h3 className="text-lg font-bold text-white">Workplace Safety News</h3>
              <p className="text-sm text-red-100">Latest safety alerts from official agencies</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAlerts}
              disabled={isLoading}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh alerts"
            >
              <svg
                className={`w-5 h-5 text-white ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Country Filter Row */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-900">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Filter by country:</span>
          <button
            onClick={() => setSelectedCountry(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
              !selectedCountry
                ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 ring-2 ring-whs-orange-500'
                : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
            }`}
          >
            🌍 All
          </button>
          {Object.entries(SAFETY_SOURCES).map(([key, source]) => (
            <button
              key={key}
              onClick={() => setSelectedCountry(selectedCountry === source.country ? null : source.country)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                selectedCountry === source.country
                  ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 ring-2 ring-whs-orange-500'
                  : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
              }`}
              title={source.fullName}
            >
              <span className="text-base">{source.flag}</span>
              <span>{source.country}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-whs-dark-700">
        <div className="flex flex-wrap gap-2">
          {/* Category filters */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                !selectedCategory
                  ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300'
                  : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
              }`}
            >
              All
            </button>
            {Object.entries(ALERT_CATEGORIES).slice(0, 5).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                  selectedCategory === key
                    ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300'
                    : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Severity filters */}
          <div className="flex items-center gap-1 ml-auto">
            {Object.entries(SEVERITY_LEVELS).map(([key, sev]) => (
              <button
                key={key}
                onClick={() => setSelectedSeverity(selectedSeverity === key ? null : key)}
                className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                  selectedSeverity === key
                    ? sev.color
                    : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
                }`}
              >
                {sev.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isExpanded={expandedAlert === alert.id}
              onToggle={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
            />
          ))
        ) : (
          <div className="text-center py-8">
            <span className="text-4xl mb-3 block">🔍</span>
            <p className="text-gray-600 dark:text-gray-400">No alerts match your filters</p>
            <button
              onClick={() => {
                setSelectedCategory(null)
                setSelectedSeverity(null)
                setSelectedCountry(null)
              }}
              className="text-whs-orange-600 dark:text-whs-orange-400 text-sm mt-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filteredAlerts.length} of {alerts.length} alerts
          </p>
          {/* Data source indicator */}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            dataSource === 'live'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : dataSource === 'cached'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            {dataSource === 'live' ? '🔴 Live Feed' : dataSource === 'cached' ? '💾 Cached' : '📋 Sample Data'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Updated: {formatRelativeDate(lastUpdated.toISOString().split('T')[0])}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default LessonsLearnedFeed

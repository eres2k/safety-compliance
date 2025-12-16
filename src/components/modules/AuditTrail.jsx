import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { Card, CardContent, Button } from '../ui'
import { exportAuditTrail } from '../../services/exportService'

const ACTION_CONFIG = {
  status_change: { label: 'Status Change', icon: '📝', color: 'text-blue-500 bg-blue-500/10' },
  risk_assessment_added: { label: 'Risk Assessment', icon: '⚠️', color: 'text-orange-500 bg-orange-500/10' },
  checklist_started: { label: 'Checklist Started', icon: '📋', color: 'text-purple-500 bg-purple-500/10' },
  checklist_completed: { label: 'Checklist Completed', icon: '✅', color: 'text-green-500 bg-green-500/10' },
  checklist_saved: { label: 'Checklist Saved', icon: '💾', color: 'text-gray-500 bg-gray-500/10' },
  training_completed: { label: 'Training Completed', icon: '🎓', color: 'text-green-500 bg-green-500/10' },
  training_uncompleted: { label: 'Training Unmarked', icon: '🎓', color: 'text-yellow-500 bg-yellow-500/10' },
  law_viewed: { label: 'Law Viewed', icon: '📖', color: 'text-blue-500 bg-blue-500/10' },
  comparison_made: { label: 'Comparison', icon: '🔄', color: 'text-purple-500 bg-purple-500/10' },
  search_performed: { label: 'Search', icon: '🔍', color: 'text-gray-500 bg-gray-500/10' }
}

export function AuditTrail({ onBack }) {
  const { framework, frameworkColors, auditTrail, clearAuditTrail } = useApp()

  const [filterAction, setFilterAction] = useState('all')
  const [filterFramework, setFilterFramework] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Filter audit entries
  const filteredEntries = useMemo(() => {
    let entries = [...auditTrail]

    // Filter by action type
    if (filterAction !== 'all') {
      entries = entries.filter(e => e.action === filterAction)
    }

    // Filter by framework
    if (filterFramework !== 'all') {
      entries = entries.filter(e => e.framework === filterFramework)
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date()
      const cutoff = new Date()

      switch (dateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0)
          break
        case 'week':
          cutoff.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoff.setMonth(now.getMonth() - 1)
          break
        default:
          break
      }

      if (dateRange !== 'all') {
        entries = entries.filter(e => new Date(e.timestamp) >= cutoff)
      }
    }

    return entries
  }, [auditTrail, filterAction, filterFramework, dateRange])

  // Get unique action types from entries
  const actionTypes = useMemo(() => {
    return [...new Set(auditTrail.map(e => e.action))].filter(Boolean)
  }, [auditTrail])

  // Handle export
  const handleExport = (action) => {
    exportAuditTrail(filteredEntries, { framework, action })
  }

  // Handle clear
  const handleClear = () => {
    clearAuditTrail()
    setShowClearConfirm(false)
  }

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups = {}
    filteredEntries.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(entry)
    })
    return groups
  }, [filteredEntries])

  // Stats
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      total: auditTrail.length,
      today: auditTrail.filter(e => new Date(e.timestamp) >= today).length,
      byFramework: {
        AT: auditTrail.filter(e => e.framework === 'AT').length,
        DE: auditTrail.filter(e => e.framework === 'DE').length,
        NL: auditTrail.filter(e => e.framework === 'NL').length
      }
    }
  }, [auditTrail])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-whs-dark-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Trail</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track all compliance activities and reviews
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('print')}>
            Print
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('download')}>
            Export
          </Button>
          {auditTrail.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => setShowClearConfirm(true)}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Entries</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-whs-orange-500">{stats.today}</div>
          <div className="text-sm text-gray-500">Today</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-red-500">{stats.byFramework.AT}</div>
          <div className="text-sm text-gray-500">Austria 🇦🇹</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-yellow-500">{stats.byFramework.DE}</div>
          <div className="text-sm text-gray-500">Germany 🇩🇪</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{stats.byFramework.NL}</div>
          <div className="text-sm text-gray-500">Netherlands 🇳🇱</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Action Type</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
              >
                <option value="all">All Actions</option>
                {actionTypes.map(action => (
                  <option key={action} value={action}>
                    {ACTION_CONFIG[action]?.label || action}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Framework</label>
              <select
                value={filterFramework}
                onChange={(e) => setFilterFramework(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
              >
                <option value="all">All Frameworks</option>
                <option value="AT">Austria 🇦🇹</option>
                <option value="DE">Germany 🇩🇪</option>
                <option value="NL">Netherlands 🇳🇱</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            <div className="ml-auto text-sm text-gray-500">
              Showing {filteredEntries.length} of {auditTrail.length} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {Object.keys(groupedEntries).length > 0 ? (
        <Card>
          <CardContent className="p-6">
            {Object.entries(groupedEntries).map(([date, entries]) => (
              <div key={date} className="mb-8 last:mb-0">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 sticky top-0 bg-white dark:bg-whs-dark-800 py-2">
                  {date}
                </h3>
                <div className="space-y-4 pl-4 border-l-2 border-gray-200 dark:border-whs-dark-700">
                  {entries.map(entry => {
                    const config = ACTION_CONFIG[entry.action] || {
                      label: entry.action,
                      icon: '📌',
                      color: 'text-gray-500 bg-gray-500/10'
                    }

                    return (
                      <div key={entry.id} className="relative pl-6">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[9px] w-4 h-4 rounded-full ${config.color} flex items-center justify-center text-xs`}>
                          {config.icon}
                        </div>

                        <div className="bg-gray-50 dark:bg-whs-dark-700 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                                  {config.label}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {entry.framework === 'AT' ? '🇦🇹' : entry.framework === 'DE' ? '🇩🇪' : '🇳🇱'}
                                </span>
                              </div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {entry.lawTitle || entry.lawId || 'N/A'}
                              </p>
                              {entry.notes && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  {entry.notes}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Audit Entries</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {auditTrail.length === 0
              ? 'Start using the app to track your compliance activities.'
              : 'No entries match the current filters.'}
          </p>
        </Card>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Clear Audit Trail?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                This will permanently delete all {auditTrail.length} audit entries. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowClearConfirm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleClear}>
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default AuditTrail

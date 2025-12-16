import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { Card, CardContent, Button } from '../ui'
import { getAllLaws } from '../../services/euLawsDatabase'
import { exportComplianceSummary } from '../../services/exportService'

const STATUS_CONFIG = {
  compliant: {
    label: 'Compliant',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    icon: '✓'
  },
  partial: {
    label: 'Partial',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    icon: '◐'
  },
  'non-compliant': {
    label: 'Non-Compliant',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    icon: '✗'
  },
  'not-reviewed': {
    label: 'Not Reviewed',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    icon: '○'
  }
}

export function ComplianceDashboard({ onBack }) {
  const {
    framework,
    frameworkColors,
    complianceStatus,
    updateComplianceStatus,
    getComplianceStats,
    auditTrail,
    addAuditEntry
  } = useApp()

  const [selectedFilter, setSelectedFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

  // Get all laws for the current framework
  const allLaws = useMemo(() => {
    try {
      return getAllLaws(framework)
    } catch {
      return []
    }
  }, [framework])

  // Get compliance stats
  const stats = getComplianceStats()

  // Filter laws based on selected filter
  const filteredLaws = useMemo(() => {
    if (selectedFilter === 'all') return allLaws

    return allLaws.filter(law => {
      const status = complianceStatus[law.id]
      if (!status || selectedFilter === 'not-reviewed') {
        return !status || status.status === 'not-reviewed'
      }
      return status.status === selectedFilter
    })
  }, [allLaws, selectedFilter, complianceStatus])

  // Handle status change
  const handleStatusChange = (lawId, lawTitle, newStatus) => {
    updateComplianceStatus(lawId, newStatus)
    addAuditEntry({
      action: 'status_change',
      lawId,
      lawTitle,
      newStatus,
      notes: `Status changed to ${newStatus}`
    })
  }

  // Calculate completion percentage
  const completionPercentage = stats.total > 0
    ? Math.round(((stats.compliant + stats.partial) / (stats.total + (allLaws.length - stats.total))) * 100)
    : 0

  // Export dashboard
  const handleExport = (action) => {
    const details = allLaws.map(law => ({
      lawId: law.id,
      title: law.abbreviation || law.title,
      status: complianceStatus[law.id]?.status || 'not-reviewed',
      updatedAt: complianceStatus[law.id]?.updatedAt
    }))
    exportComplianceSummary(stats, details, { framework, action })
  }

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track compliance status across {frameworkColors[framework]?.name} regulations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('print')}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('download')}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Progress Ring */}
        <Card className="md:col-span-1 p-4">
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-whs-dark-700"
                  strokeWidth="8"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  className="text-green-500"
                  strokeWidth="8"
                  strokeDasharray={`${completionPercentage * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{completionPercentage}%</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Overall Progress</p>
          </div>
        </Card>

        {/* Status Cards */}
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setSelectedFilter(selectedFilter === key ? 'all' : key)}
            className={`p-4 rounded-xl border transition-all ${
              selectedFilter === key
                ? `${config.bgColor} ${config.borderColor} border-2`
                : 'bg-white dark:bg-whs-dark-800 border-gray-200 dark:border-whs-dark-700 hover:border-gray-300 dark:hover:border-whs-dark-600'
            }`}
          >
            <div className={`text-3xl font-bold ${config.color}`}>
              {key === 'compliant' ? stats.compliant :
               key === 'partial' ? stats.partial :
               key === 'non-compliant' ? stats.nonCompliant :
               allLaws.length - stats.total}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{config.label}</div>
          </button>
        ))}
      </div>

      {/* Jurisdictions Overview */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Compliance by Jurisdiction
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {['AT', 'DE', 'NL'].map(fw => {
              const fwColor = frameworkColors[fw]
              const fwLaws = allLaws.filter(l => l.framework === fw || framework === fw)
              const fwCompliant = Object.entries(complianceStatus)
                .filter(([, v]) => v.framework === fw && v.status === 'compliant').length
              const fwTotal = Object.entries(complianceStatus)
                .filter(([, v]) => v.framework === fw).length

              return (
                <div
                  key={fw}
                  className={`p-4 rounded-lg border ${
                    framework === fw
                      ? 'bg-whs-orange-50 dark:bg-whs-orange-900/20 border-whs-orange-200 dark:border-whs-orange-800'
                      : 'bg-gray-50 dark:bg-whs-dark-700 border-gray-200 dark:border-whs-dark-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">
                      {fw === 'AT' ? '🇦🇹' : fw === 'DE' ? '🇩🇪' : '🇳🇱'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">{fwColor?.name}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {fwCompliant}/{fwTotal || 0} reviewed
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-whs-dark-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${fwTotal > 0 ? (fwCompliant / fwTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Laws List */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Laws & Regulations ({filteredLaws.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-whs-orange-500 text-white' : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400'}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-whs-orange-500 text-white' : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400'}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLaws.slice(0, 30).map(law => {
                const status = complianceStatus[law.id]?.status || 'not-reviewed'
                const config = STATUS_CONFIG[status]

                return (
                  <div
                    key={law.id}
                    className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                          {law.abbreviation || law.title?.substring(0, 30)}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {law.type}
                        </p>
                      </div>
                      <span className={`text-lg ${config.color}`}>{config.icon}</span>
                    </div>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(law.id, law.abbreviation || law.title, e.target.value)}
                      className="w-full mt-2 px-2 py-1.5 text-sm bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whs-orange-500"
                    >
                      <option value="not-reviewed">Not Reviewed</option>
                      <option value="compliant">Compliant</option>
                      <option value="partial">Partial</option>
                      <option value="non-compliant">Non-Compliant</option>
                    </select>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLaws.slice(0, 50).map(law => {
                const status = complianceStatus[law.id]?.status || 'not-reviewed'
                const config = STATUS_CONFIG[status]

                return (
                  <div
                    key={law.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-whs-dark-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg ${config.color}`}>{config.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                          {law.abbreviation || law.title?.substring(0, 50)}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{law.type}</p>
                      </div>
                    </div>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(law.id, law.abbreviation || law.title, e.target.value)}
                      className="px-3 py-1.5 text-sm bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whs-orange-500"
                    >
                      <option value="not-reviewed">Not Reviewed</option>
                      <option value="compliant">Compliant</option>
                      <option value="partial">Partial</option>
                      <option value="non-compliant">Non-Compliant</option>
                    </select>
                  </div>
                )
              })}
            </div>
          )}

          {filteredLaws.length > 30 && viewMode === 'grid' && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              Showing 30 of {filteredLaws.length} laws. Switch to list view to see more.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {auditTrail.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {auditTrail.slice(0, 5).map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-whs-dark-700 last:border-0"
                >
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {entry.lawTitle || entry.lawId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.notes}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ComplianceDashboard

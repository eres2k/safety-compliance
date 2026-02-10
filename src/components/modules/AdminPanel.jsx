import { useState, useEffect, useCallback, useMemo } from 'react'

// ============================================
// Admin Panel - Full System Management
// Tabs: Overview, Chat Logs, AI Settings, Database, Sources, Errors
// ============================================

const ADMIN_TOKEN_KEY = 'admin_auth_token'

function getStoredToken() {
  try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) } catch { return null }
}
function setStoredToken(token) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch { /* noop */ }
}

async function adminFetch(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })
}

// ============================================
// Shared UI Components
// ============================================
function Spinner() {
  return <div className="w-8 h-8 border-3 border-whs-orange-500 border-t-transparent rounded-full animate-spin" />
}

function InfoField({ label, value, highlight, className = '' }) {
  return (
    <div className={`p-2.5 rounded-lg ${highlight ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-whs-dark-700'} ${className}`}>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{value || 'N/A'}</p>
    </div>
  )
}

function SectionCard({ title, children, actions, className = '' }) {
  return (
    <div className={`bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-whs-dark-700">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h3>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

function BarChart({ data, colors, title }) {
  const total = Object.values(data).reduce((s, c) => s + c, 0) || 1
  const defaultColors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500', 'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500']
  const colorList = colors || defaultColors

  return (
    <SectionCard title={title}>
      <div className="space-y-3">
        {Object.entries(data).map(([key, count], i) => (
          <div key={key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300 font-medium truncate mr-2">{key}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{count} ({Math.round(count / total * 100)}%)</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-whs-dark-700 rounded-full overflow-hidden">
              <div className={`h-full ${colorList[i % colorList.length]} rounded-full transition-all duration-500`} style={{ width: `${(count / total) * 100}%` }} />
            </div>
          </div>
        ))}
        {Object.keys(data).length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No data yet</p>}
      </div>
    </SectionCard>
  )
}

function ConfirmButton({ onClick, label, confirmLabel, className = '', disabled }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    setLoading(true)
    try { await onClick() } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-40 ${
        confirming
          ? 'bg-red-500 text-white hover:bg-red-600'
          : className || 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-600'
      }`}
    >
      {loading ? 'Processing...' : confirming ? confirmLabel || 'Confirm?' : label}
    </button>
  )
}

// ============================================
// Login
// ============================================
function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/chat-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', password })
      })
      const data = await res.json()
      if (data.success) { setStoredToken(password); onLogin(password) }
      else setError('Invalid password')
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-whs-dark-700 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-whs-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-whs-orange-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Access</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter admin password to continue</p>
          </div>
          <form onSubmit={handleSubmit}>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 text-sm" autoFocus />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <button type="submit" disabled={loading || !password}
              className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-whs-orange-500 to-amber-600 text-white font-medium rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Tab: Overview
// ============================================
function OverviewTab({ stats, cacheStats, token }) {
  const cards = [
    { label: 'Total Interactions', value: stats?.totalLogs || 0, color: 'from-blue-500 to-blue-600', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { label: 'Last 24h', value: stats?.last24h || 0, color: 'from-green-500 to-emerald-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Last 7 Days', value: stats?.last7d || 0, color: 'from-purple-500 to-purple-600', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Cache Hit Rate', value: `${stats?.cachedPercent || 0}%`, color: 'from-amber-500 to-orange-600', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'Blocked', value: stats?.blockedCount || 0, color: 'from-red-500 to-red-600', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
    { label: 'Errors', value: stats?.errorCount || 0, color: 'from-rose-500 to-rose-600', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    { label: 'Unique IPs', value: stats?.uniqueIPs || 0, color: 'from-indigo-500 to-indigo-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Avg Response', value: stats?.avgResponseLength ? `${Math.round(stats.avgResponseLength / 1000)}k` : '0', color: 'from-teal-500 to-teal-600', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
  ]

  if (!stats) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 p-3 shadow-sm">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-2 shadow-sm`}>
              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={card.icon} />
              </svg>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BarChart data={stats.modelBreakdown || {}} title="Model Usage" />
        <BarChart data={stats.featureBreakdown || {}} title="Feature Usage" colors={['bg-indigo-500', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500']} />
        <BarChart data={stats.frameworkBreakdown || {}} title="Framework Usage" colors={['bg-red-500', 'bg-yellow-500', 'bg-orange-500', 'bg-gray-400']} />
      </div>

      {/* Hourly Activity + Cache Info */}
      <div className="grid md:grid-cols-2 gap-4">
        <SectionCard title="24h Activity">
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 24 }, (_, h) => {
              const count = stats.hourlyActivity?.[h] || 0
              const maxCount = Math.max(1, ...Object.values(stats.hourlyActivity || {}))
              const height = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h}:00 - ${count} requests`}>
                  <div className={`w-full rounded-t transition-all ${count > 0 ? 'bg-whs-orange-500' : 'bg-gray-200 dark:bg-whs-dark-600'}`} style={{ height: `${height}%` }} />
                  {h % 6 === 0 && <span className="text-[8px] text-gray-400">{h}</span>}
                </div>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard title="Cache Statistics" actions={
          cacheStats && <span className="text-xs text-gray-500">{cacheStats.totalEntries} entries</span>
        }>
          {cacheStats ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-whs-dark-700">
                <span className="text-gray-500 dark:text-gray-400">Total Entries</span>
                <span className="text-gray-900 dark:text-white font-medium">{cacheStats.totalEntries}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-whs-dark-700">
                <span className="text-gray-500 dark:text-gray-400">Total Size</span>
                <span className="text-gray-900 dark:text-white font-medium">{cacheStats.totalSizeKB} KB</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-whs-dark-700">
                <span className="text-gray-500 dark:text-gray-400">Oldest Entry</span>
                <span className="text-gray-900 dark:text-white font-medium text-xs">{cacheStats.oldestEntry ? new Date(cacheStats.oldestEntry).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500 dark:text-gray-400">Cache TTL</span>
                <span className="text-gray-900 dark:text-white font-medium">{cacheStats.cacheTTL}</span>
              </div>
            </div>
          ) : <p className="text-sm text-gray-500 text-center py-4">Loading...</p>}
        </SectionCard>
      </div>
    </div>
  )
}

// ============================================
// Tab: Chat Logs
// ============================================
function ChatLogsTab({ token }) {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)
  const [filterFeature, setFilterFeature] = useState('all')
  const limit = 30

  const fetchLogs = useCallback(async (newOffset = 0) => {
    setLoading(true)
    try {
      const res = await adminFetch(`/.netlify/functions/chat-logs?action=list&offset=${newOffset}&limit=${limit}`, token)
      const data = await res.json()
      setLogs(data.entries || [])
      setTotal(data.total || 0)
      setOffset(newOffset)
    } catch { setLogs([]) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchLogs(0) }, [fetchLogs])

  const filteredLogs = useMemo(() => {
    if (filterFeature === 'all') return logs
    return logs.filter(l => l.feature === filterFeature)
  }, [logs, filterFeature])

  const features = useMemo(() => {
    const set = new Set(logs.map(l => l.feature).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [logs])

  const statusBadge = (log) => {
    if (log.blocked) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">BLOCKED</span>
    if (log.error) return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">ERROR</span>
    if (log.cached) return <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">CACHED</span>
    return <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">LIVE</span>
  }

  const featureColors = {
    chatbot: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    simplify: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    flowchart: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    'cross-border': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    'multi-country': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    translate: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
    compliance: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    explain: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    general: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Feature:</span>
        {features.map(f => (
          <button key={f} onClick={() => setFilterFeature(f)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
              filterFeature === f
                ? 'bg-whs-orange-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <ConfirmButton onClick={async () => {
            await adminFetch('/.netlify/functions/admin-settings', token, {
              method: 'POST', body: JSON.stringify({ action: 'clear-logs' })
            })
            fetchLogs(0)
          }} label="Clear Logs" confirmLabel="Confirm Clear?" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100" />
          <button onClick={() => fetchLogs(0)} className="p-1.5 bg-gray-100 dark:bg-whs-dark-700 hover:bg-gray-200 dark:hover:bg-whs-dark-600 rounded-lg transition-colors" title="Refresh">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="font-medium">No chat logs</p>
            <p className="text-xs mt-1">Interactions will appear here once users start chatting</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-whs-dark-700/50 text-left">
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feature</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">FW</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Model</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">In/Out</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-whs-dark-700">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-whs-dark-700/50 transition-colors">
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 font-mono">{(log.ip || '').substring(0, 15)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${featureColors[log.feature] || featureColors.general}`}>
                          {log.feature || '?'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">{log.framework || '-'}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {(log.model || '').replace('gemini-', '')}
                        </span>
                      </td>
                      <td className="px-3 py-2">{statusBadge(log)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {log.promptLength || 0}/{log.responseLength || 0}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => setSelectedLog(log.id)}
                          className="p-1 text-whs-orange-500 hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20 rounded transition-colors" title="View details">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit && (
              <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-700/30">
                <button onClick={() => fetchLogs(Math.max(0, offset - limit))} disabled={offset === 0}
                  className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg disabled:opacity-40 transition-colors">Previous</button>
                <span className="text-xs text-gray-500">Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}</span>
                <button onClick={() => fetchLogs(offset + limit)} disabled={offset + limit >= total}
                  className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg disabled:opacity-40 transition-colors">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <LogDetailModal logId={selectedLog} token={token} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  )
}

function LogDetailModal({ logId, token, onClose }) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!logId) return
    setLoading(true)
    adminFetch(`/.netlify/functions/chat-logs?action=detail&id=${logId}`, token)
      .then(res => res.json()).then(setEntry).catch(() => setEntry(null)).finally(() => setLoading(false))
  }, [logId, token])

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-whs-dark-700 w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-whs-orange-500 to-amber-600 text-white">
          <h3 className="font-bold">Interaction Detail</h3>
          <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 max-h-[60vh]">
          {loading ? <div className="flex justify-center py-8"><Spinner /></div> : entry ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm">
                <InfoField label="Timestamp" value={new Date(entry.timestamp).toLocaleString()} />
                <InfoField label="IP Address" value={entry.ip} />
                <InfoField label="Feature" value={entry.feature || 'N/A'} />
                <InfoField label="Framework" value={entry.framework || 'N/A'} />
                <InfoField label="Model" value={entry.model || 'N/A'} />
                <InfoField label="Cached" value={entry.cached ? `Yes (${entry.cacheAge || ''})` : 'No'} />
                <InfoField label="Prompt Length" value={`${entry.promptLength || 0} chars`} />
                <InfoField label="Response Length" value={`${entry.responseLength || 0} chars`} />
                {entry.blocked && <InfoField label="Blocked" value={`${entry.blockReason} (${entry.blockType})`} highlight />}
                {entry.error && <InfoField label="Error" value={entry.errorMessage} highlight />}
              </div>
              {entry.promptPreview && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Prompt Preview</h4>
                  <pre className="text-xs bg-gray-50 dark:bg-whs-dark-700 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{entry.promptPreview}</pre>
                </div>
              )}
              {entry.responsePreview && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Response Preview</h4>
                  <pre className="text-xs bg-gray-50 dark:bg-whs-dark-700 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{entry.responsePreview}</pre>
                </div>
              )}
            </>
          ) : <p className="text-gray-500 text-center py-4">Entry not found</p>}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Tab: AI Settings
// ============================================
function AISettingsTab({ token }) {
  const [settings, setSettings] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/.netlify/functions/admin-settings?action=settings', token)
      const data = await res.json()
      setSettings(data.settings)
      setDefaults(data.defaults)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const updateField = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }))
    setSaved(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await adminFetch('/.netlify/functions/admin-settings', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'update-settings', settings })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  const resetSettings = async () => {
    const res = await adminFetch('/.netlify/functions/admin-settings', token, {
      method: 'POST',
      body: JSON.stringify({ action: 'reset-settings' })
    })
    const data = await res.json()
    setSettings(data.settings)
  }

  if (loading || !settings) return <div className="flex justify-center py-12"><Spinner /></div>

  const SettingRow = ({ label, desc, section, field, type = 'number', options }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-whs-dark-700 last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {desc && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {type === 'toggle' ? (
        <button onClick={() => updateField(section, field, !settings[section]?.[field])}
          className={`relative w-11 h-6 rounded-full transition-colors ${settings[section]?.[field] ? 'bg-whs-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[section]?.[field] ? 'translate-x-5.5 left-0' : 'left-0.5'}`} />
        </button>
      ) : type === 'select' ? (
        <select value={settings[section]?.[field] || ''} onChange={e => updateField(section, field, e.target.value)}
          className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:ring-2 focus:ring-whs-orange-500/50">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type="number" value={settings[section]?.[field] ?? ''} onChange={e => updateField(section, field, Number(e.target.value))}
          className="w-24 px-3 py-1.5 text-sm text-right bg-gray-50 dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg focus:ring-2 focus:ring-whs-orange-500/50" />
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Save Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm p-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">AI Configuration</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Changes are saved to server and take effect on next request</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Saved!</span>}
          <ConfirmButton onClick={resetSettings} label="Reset to Defaults" confirmLabel="Reset All?" />
          <button onClick={saveSettings} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-whs-orange-500 text-white rounded-lg hover:bg-whs-orange-600 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Rate Limits */}
        <SectionCard title="Rate Limiting">
          <SettingRow label="Client Wait Time" desc="Seconds between AI requests (client-side)" section="ai" field="clientRateLimitSeconds" />
          <SettingRow label="Server Rate Limit" desc="Max requests per minute per IP" section="ai" field="serverRateLimitPerMinute" />
          <SettingRow label="Ban Threshold" desc="Requests/min triggering 24h ban" section="ai" field="serverBanThreshold" />
          <SettingRow label="Cache TTL" desc="Hours to cache AI responses" section="ai" field="cacheTTLHours" />
        </SectionCard>

        {/* Model Settings */}
        <SectionCard title="Model Configuration">
          <SettingRow label="Primary Model" section="ai" field="primaryModel" type="select"
            options={['gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']} />
          <SettingRow label="Fallback Model" section="ai" field="fallbackModel" type="select"
            options={['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.0-flash']} />
          <SettingRow label="Max Output Tokens" section="ai" field="maxOutputTokens" />
          <SettingRow label="Temperature" desc="0.0 = deterministic, 1.0 = creative" section="ai" field="temperature" />
          <SettingRow label="Max Input Length" desc="Character limit for user prompts" section="ai" field="maxInputLength" />
        </SectionCard>

        {/* Feature Toggles */}
        <SectionCard title="Feature Toggles">
          <SettingRow label="Chatbot (Erwin)" section="features" field="chatbotEnabled" type="toggle" />
          <SettingRow label="Simplify Sections" section="features" field="simplifyEnabled" type="toggle" />
          <SettingRow label="Flowchart Generation" section="features" field="flowchartEnabled" type="toggle" />
          <SettingRow label="Cross-Border Compare" section="features" field="crossBorderEnabled" type="toggle" />
          <SettingRow label="Multi-Country Compare" section="features" field="multiCountryEnabled" type="toggle" />
          <SettingRow label="Translation" section="features" field="translateEnabled" type="toggle" />
          <SettingRow label="Compliance Checker" section="features" field="complianceEnabled" type="toggle" />
        </SectionCard>

        {/* Cache Management */}
        <SectionCard title="Cache Management">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Clear the AI response cache. Cached responses reduce API costs and speed up repeated queries.</p>
            <ConfirmButton onClick={async () => {
              await adminFetch('/.netlify/functions/admin-settings', token, {
                method: 'POST', body: JSON.stringify({ action: 'clear-cache' })
              })
            }} label="Clear AI Cache" confirmLabel="Confirm Clear Cache?"
              className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100" />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ============================================
// Tab: Database / Scraper
// ============================================
function DatabaseTab({ token }) {
  const [changelog, setChangelog] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [clRes, stRes] = await Promise.all([
          fetch('/eu_safety_laws/update_changelog.json'),
          fetch('/eu_safety_laws/statistics.json')
        ])
        if (clRes.ok) setChangelog(await clRes.json())
        if (stRes.ok) setStatistics(await stRes.json())
      } catch { /* noop */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  const stats = statistics?.statistics || {}
  const byJurisdiction = stats.by_jurisdiction || {}

  return (
    <div className="space-y-6">
      {/* Database Overview */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoField label="Total Documents" value={stats.total_documents || 0} className="bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 shadow-sm !p-4" />
        <InfoField label="Last Generated" value={statistics?.generated_at ? new Date(statistics.generated_at).toLocaleDateString() : 'N/A'} className="bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 shadow-sm !p-4" />
        <InfoField label="Total Words" value={stats.content?.total_words ? `${Math.round(stats.content.total_words / 1000)}k` : 'N/A'} className="bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 shadow-sm !p-4" />
        <InfoField label="Documents w/ Content" value={stats.content?.documents_with_content || 0} className="bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 shadow-sm !p-4" />
      </div>

      {/* Country Breakdown */}
      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(byJurisdiction).map(([country, count]) => {
          const flags = { AT: '🇦🇹', DE: '🇩🇪', NL: '🇳🇱' }
          const names = { AT: 'Austria (ASchG)', DE: 'Germany (DGUV)', NL: 'Netherlands (Arbowet)' }
          return (
            <SectionCard key={country} title={`${flags[country] || ''} ${names[country] || country}`}>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">documents</p>
              </div>
            </SectionCard>
          )
        })}
      </div>

      {/* Scraper Configuration */}
      <SectionCard title="Scraper Configuration">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-whs-dark-700">
            <span className="text-gray-500 dark:text-gray-400">Update Schedule</span>
            <span className="text-gray-900 dark:text-white font-medium">Every 2 weeks (Sunday 02:00 UTC)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-whs-dark-700">
            <span className="text-gray-500 dark:text-gray-400">Countries Tracked</span>
            <span className="text-gray-900 dark:text-white font-medium">AT, DE, NL</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-whs-dark-700">
            <span className="text-gray-500 dark:text-gray-400">Workflow</span>
            <span className="text-gray-900 dark:text-white font-medium">update-laws.yml</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500 dark:text-gray-400">Schema Version</span>
            <span className="text-gray-900 dark:text-white font-medium">2.0.0</span>
          </div>
        </div>
      </SectionCard>

      {/* Update Changelog */}
      <SectionCard title="Update Changelog" actions={
        <span className="text-xs text-gray-500">{changelog?.updates?.length || 0} updates</span>
      }>
        {changelog?.updates?.length > 0 ? (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {changelog.updates.slice(0, 20).map((update, i) => {
              const flags = { AT: '🇦🇹', DE: '🇩🇪', NL: '🇳🇱' }
              return (
                <div key={i} className="border-l-3 border-whs-orange-400 pl-4 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{flags[update.country] || ''}</span>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{update.country}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(update.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {update.new_laws?.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium">
                        +{update.new_laws.length} new: {update.new_laws.join(', ')}
                      </span>
                    )}
                    {update.updated_laws?.length > 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">
                        {update.updated_laws.length} updated
                      </span>
                    )}
                    {update.unchanged_laws?.length > 0 && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        {update.unchanged_laws.length} unchanged
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-500 text-center py-4">No update history</p>}
      </SectionCard>
    </div>
  )
}

// ============================================
// Tab: Sources
// ============================================
function SourcesTab() {
  const [laws, setLaws] = useState({ AT: [], DE: [], NL: [] })
  const [loading, setLoading] = useState(true)
  const [activeCountry, setActiveCountry] = useState('AT')

  useEffect(() => {
    const load = async () => {
      try {
        const results = {}
        for (const country of ['AT', 'DE', 'NL']) {
          try {
            const res = await fetch(`/eu_safety_laws/${country.toLowerCase()}/${country.toLowerCase()}_database.json`)
            if (res.ok) {
              const data = await res.json()
              results[country] = data.laws || data.documents || []
            }
          } catch { results[country] = [] }
        }
        setLaws(results)
      } catch { /* noop */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  const countries = [
    { id: 'AT', flag: '🇦🇹', name: 'Austria' },
    { id: 'DE', flag: '🇩🇪', name: 'Germany' },
    { id: 'NL', flag: '🇳🇱', name: 'Netherlands' }
  ]
  const currentLaws = laws[activeCountry] || []

  return (
    <div className="space-y-4">
      {/* Country Tabs */}
      <div className="flex gap-2">
        {countries.map(c => (
          <button key={c.id} onClick={() => setActiveCountry(c.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCountry === c.id
                ? 'bg-whs-orange-500 text-white shadow-md'
                : 'bg-white dark:bg-whs-dark-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-whs-dark-700 hover:bg-gray-50'
            }`}>
            <span>{c.flag}</span> {c.name} ({(laws[c.id] || []).length})
          </button>
        ))}
      </div>

      {/* Laws Table */}
      <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-whs-dark-700/80 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Abbreviation</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Title</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Type</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Sections</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-whs-dark-700">
              {currentLaws.map((law, i) => (
                <tr key={law.id || i} className="hover:bg-gray-50 dark:hover:bg-whs-dark-700/50">
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white">{law.abbreviation || law.abbr || '?'}</td>
                  <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">{law.title_en || law.title || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                      law.type === 'law' ? 'bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>{law.type || '?'}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{law.chapters?.reduce((s, ch) => s + (ch.sections?.length || 0), 0) || '-'}</td>
                  <td className="px-4 py-2">
                    {law.source?.url ? (
                      <a href={law.source.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-whs-orange-500 hover:text-whs-orange-600 hover:underline truncate block max-w-[200px]">
                        {new URL(law.source.url).hostname}
                      </a>
                    ) : <span className="text-xs text-gray-400">-</span>}
                  </td>
                </tr>
              ))}
              {currentLaws.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No laws loaded for {activeCountry}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Tab: Error Log
// ============================================
function ErrorLogTab({ token }) {
  const [errors, setErrors] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedError, setSelectedError] = useState(null)

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/.netlify/functions/admin-settings?action=errors', token)
      const data = await res.json()
      setErrors(data.entries || [])
      setTotal(data.total || 0)
    } catch { setErrors([]) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchErrors() }, [fetchErrors])

  const typeColors = {
    api_error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    function_error: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    unknown: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{total} total errors logged</p>
        <div className="flex items-center gap-2">
          <ConfirmButton onClick={async () => {
            await adminFetch('/.netlify/functions/admin-settings', token, {
              method: 'POST', body: JSON.stringify({ action: 'clear-errors' })
            })
            fetchErrors()
          }} label="Clear Errors" confirmLabel="Confirm Clear?"
            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100" />
          <button onClick={fetchErrors} className="p-1.5 bg-gray-100 dark:bg-whs-dark-700 hover:bg-gray-200 dark:hover:bg-whs-dark-600 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : errors.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">No errors logged</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-whs-dark-700 max-h-[500px] overflow-y-auto">
            {errors.map((err) => (
              <div key={err.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-whs-dark-700/50 transition-colors cursor-pointer"
                onClick={() => setSelectedError(err.id === selectedError ? null : err.id)}>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded whitespace-nowrap ${typeColors[err.type] || typeColors.unknown}`}>
                  {err.type || 'ERROR'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {new Date(err.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{err.message}</span>
                {err.statusCode && <span className="text-xs text-gray-400 font-mono">{err.statusCode}</span>}
                <span className="text-xs text-gray-400 font-mono">{(err.ip || '').substring(0, 15)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Detail */}
      {selectedError && <ErrorDetail errorId={selectedError} token={token} onClose={() => setSelectedError(null)} />}
    </div>
  )
}

function ErrorDetail({ errorId, token, onClose }) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminFetch(`/.netlify/functions/admin-settings?action=error-detail&id=${errorId}`, token)
      .then(r => r.json()).then(setEntry).catch(() => setEntry(null)).finally(() => setLoading(false))
  }, [errorId, token])

  return (
    <SectionCard title="Error Detail" actions={
      <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
    }>
      {loading ? <div className="flex justify-center py-4"><Spinner /></div> : entry ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <InfoField label="Type" value={entry.type} highlight />
            <InfoField label="Status Code" value={entry.statusCode} />
            <InfoField label="Timestamp" value={new Date(entry.timestamp).toLocaleString()} />
            <InfoField label="IP" value={entry.ip} />
            {entry.model && <InfoField label="Model" value={entry.model} />}
            {entry.feature && <InfoField label="Feature" value={entry.feature} />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Message</h4>
            <pre className="text-xs bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-wrap break-words">{entry.message}</pre>
          </div>
          {entry.stack && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Stack Trace</h4>
              <pre className="text-xs bg-gray-50 dark:bg-whs-dark-700 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600 whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">{entry.stack}</pre>
            </div>
          )}
        </div>
      ) : <p className="text-gray-500 text-center py-4">Error not found</p>}
    </SectionCard>
  )
}

// ============================================
// Main Admin Panel
// ============================================
export function AdminPanel({ onBack }) {
  const [token, setToken] = useState(getStoredToken())
  const [stats, setStats] = useState(null)
  const [cacheStats, setCacheStats] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const [statsRes, cacheRes] = await Promise.all([
        adminFetch('/.netlify/functions/chat-logs?action=stats', token),
        adminFetch('/.netlify/functions/admin-settings?action=cache-stats', token)
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      else if (statsRes.status === 401) { setToken(null); setStoredToken(null); return }
      if (cacheRes.ok) setCacheStats(await cacheRes.json())
    } catch { /* noop */ }
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLogin = (pw) => { setToken(pw); setStoredToken(pw) }
  const handleLogout = () => { setToken(null); setStoredToken(null); setStats(null); setCacheStats(null) }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { id: 'logs', label: 'Chat Logs', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'ai-settings', label: 'AI Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { id: 'database', label: 'Database', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
    { id: 'sources', label: 'Sources', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'errors', label: 'Errors', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' }
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 hover:bg-gray-50 dark:hover:bg-whs-dark-700 transition-colors">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">System monitoring, AI configuration, and database management</p>
        </div>
        {token && (
          <button onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-whs-dark-700 hover:bg-gray-200 dark:hover:bg-whs-dark-600 rounded-xl transition-colors">
            Sign Out
          </button>
        )}
      </div>

      {!token ? <AdminLogin onLogin={handleLogin} /> : (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-1.5 border-b border-gray-200 dark:border-whs-dark-700 pb-2 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-whs-orange-500 text-white shadow-md shadow-whs-orange-500/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-whs-dark-700'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                </svg>
                {tab.label}
                {tab.id === 'errors' && stats?.errorCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500 text-white">{stats.errorCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && <OverviewTab stats={stats} cacheStats={cacheStats} token={token} />}
          {activeTab === 'logs' && <ChatLogsTab token={token} />}
          {activeTab === 'ai-settings' && <AISettingsTab token={token} />}
          {activeTab === 'database' && <DatabaseTab token={token} />}
          {activeTab === 'sources' && <SourcesTab />}
          {activeTab === 'errors' && <ErrorLogTab token={token} />}
        </>
      )}
    </div>
  )
}

export default AdminPanel

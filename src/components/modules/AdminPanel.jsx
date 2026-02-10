import { useState, useEffect, useCallback } from 'react'

// ============================================
// Admin Panel - Chat Logs & System Statistics
// Protected by admin password authentication
// ============================================

const ADMIN_TOKEN_KEY = 'admin_auth_token'

function getStoredToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

function setStoredToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    }
  } catch {
    // sessionStorage not available
  }
}

// Fetch helper with admin auth
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
// Login Screen
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

      if (data.success) {
        setStoredToken(password)
        onLogin(password)
      } else {
        setError('Invalid password')
      }
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-whs-orange-500/50 focus:border-whs-orange-500 text-sm"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-whs-orange-500 to-amber-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-whs-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Stats Cards
// ============================================
function StatsCards({ stats }) {
  const cards = [
    { label: 'Total Interactions', value: stats.totalLogs || 0, color: 'from-blue-500 to-blue-600', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { label: 'Last 24h', value: stats.last24h || 0, color: 'from-green-500 to-emerald-600', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Last 7 Days', value: stats.last7d || 0, color: 'from-purple-500 to-purple-600', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Cache Hit Rate', value: `${stats.cachedPercent || 0}%`, color: 'from-amber-500 to-orange-600', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'Blocked', value: stats.blockedCount || 0, color: 'from-red-500 to-red-600', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
    { label: 'Unique IPs', value: stats.uniqueIPs || 0, color: 'from-indigo-500 to-indigo-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 p-4 shadow-sm">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-sm`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={card.icon} />
            </svg>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Chat Log Detail Modal
// ============================================
function LogDetailModal({ logId, token, onClose }) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!logId) return
    setLoading(true)
    adminFetch(`/.netlify/functions/chat-logs?action=detail&id=${logId}`, token)
      .then(res => res.json())
      .then(data => setEntry(data))
      .catch(() => setEntry(null))
      .finally(() => setLoading(false))
  }, [logId, token])

  if (!logId) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-whs-dark-700 w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-whs-dark-700 bg-gradient-to-r from-whs-orange-500 to-amber-600 text-white">
          <h3 className="font-bold">Chat Log Detail</h3>
          <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-3 border-whs-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : entry ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoField label="Timestamp" value={new Date(entry.timestamp).toLocaleString()} />
                <InfoField label="IP Address" value={entry.ip} />
                <InfoField label="Model" value={entry.model || 'N/A'} />
                <InfoField label="Cached" value={entry.cached ? 'Yes' : 'No'} />
                <InfoField label="Prompt Length" value={`${entry.promptLength || 0} chars`} />
                <InfoField label="Response Length" value={`${entry.responseLength || 0} chars`} />
                {entry.blocked && <InfoField label="Blocked" value={`${entry.blockReason} (${entry.blockType})`} highlight />}
              </div>

              {entry.promptPreview && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Prompt Preview</h4>
                  <pre className="text-xs bg-gray-50 dark:bg-whs-dark-700 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {entry.promptPreview}
                  </pre>
                </div>
              )}

              {entry.responsePreview && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Response Preview</h4>
                  <pre className="text-xs bg-gray-50 dark:bg-whs-dark-700 p-3 rounded-lg border border-gray-200 dark:border-whs-dark-600 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {entry.responsePreview}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-center py-4">Entry not found</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoField({ label, value, highlight }) {
  return (
    <div className={`p-2 rounded-lg ${highlight ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-whs-dark-700'}`}>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{value || 'N/A'}</p>
    </div>
  )
}

// ============================================
// Chat Logs Table
// ============================================
function ChatLogsTable({ token }) {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)
  const limit = 25

  const fetchLogs = useCallback(async (newOffset = 0) => {
    setLoading(true)
    try {
      const res = await adminFetch(`/.netlify/functions/chat-logs?action=list&offset=${newOffset}&limit=${limit}`, token)
      const data = await res.json()
      setLogs(data.entries || [])
      setTotal(data.total || 0)
      setOffset(newOffset)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchLogs(0)
  }, [fetchLogs])

  return (
    <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-whs-dark-700">
        <h3 className="font-bold text-gray-900 dark:text-white">Chat Interactions</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => fetchLogs(0)}
            className="p-1.5 bg-gray-100 dark:bg-whs-dark-700 hover:bg-gray-200 dark:hover:bg-whs-dark-600 rounded-lg transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-whs-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>No chat logs yet</p>
          <p className="text-xs mt-1">Interactions will appear here once users start chatting</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-whs-dark-700/50 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Length</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-whs-dark-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-whs-dark-700/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300 font-mono">{log.ip?.substring(0, 15) || 'N/A'}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {log.model || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {log.blocked ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">BLOCKED</span>
                      ) : log.cached ? (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">CACHED</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">LIVE</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                      {log.promptLength || 0}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setSelectedLog(log.id)}
                        className="p-1 text-whs-orange-500 hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20 rounded transition-colors"
                        title="View details"
                      >
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

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-700/30">
              <button
                onClick={() => fetchLogs(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-whs-dark-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => fetchLogs(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-whs-dark-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <LogDetailModal logId={selectedLog} token={token} onClose={() => setSelectedLog(null)} />
    </div>
  )
}

// ============================================
// Model Breakdown Chart
// ============================================
function ModelBreakdown({ stats }) {
  const models = stats.modelBreakdown || {}
  const total = Object.values(models).reduce((sum, count) => sum + count, 0) || 1
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500', 'bg-red-500']

  return (
    <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm p-4">
      <h3 className="font-bold text-gray-900 dark:text-white mb-4">Model Usage</h3>
      <div className="space-y-3">
        {Object.entries(models).map(([model, count], i) => (
          <div key={model}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300 font-medium">{model}</span>
              <span className="text-gray-500 dark:text-gray-400">{count} ({Math.round(count / total * 100)}%)</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-whs-dark-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[i % colors.length]} rounded-full transition-all duration-500`}
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {Object.keys(models).length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No data yet</p>
        )}
      </div>
    </div>
  )
}

// ============================================
// Main Admin Panel
// ============================================
export function AdminPanel({ onBack }) {
  const [token, setToken] = useState(getStoredToken())
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchStats = useCallback(async () => {
    if (!token) return
    try {
      const res = await adminFetch('/.netlify/functions/chat-logs?action=stats', token)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      } else if (res.status === 401) {
        setToken(null)
        setStoredToken(null)
      }
    } catch {
      // Network error
    }
  }, [token])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleLogin = (pw) => {
    setToken(pw)
    setStoredToken(pw)
  }

  const handleLogout = () => {
    setToken(null)
    setStoredToken(null)
    setStats(null)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { id: 'logs', label: 'Chat Logs', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' }
  ]

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
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">System monitoring and chat log management</p>
        </div>
        {token && (
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-whs-dark-700 hover:bg-gray-200 dark:hover:bg-whs-dark-600 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        )}
      </div>

      {!token ? (
        <AdminLogin onLogin={handleLogin} />
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-whs-dark-700 pb-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-whs-orange-500 text-white shadow-md shadow-whs-orange-500/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-whs-dark-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {stats ? (
                <>
                  <StatsCards stats={stats} />
                  <div className="grid md:grid-cols-2 gap-6">
                    <ModelBreakdown stats={stats} />
                    <div className="bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 shadow-sm p-4">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-4">System Info</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-whs-dark-700">
                          <span className="text-gray-500 dark:text-gray-400">Log Storage</span>
                          <span className="text-gray-900 dark:text-white font-medium">Netlify Blobs</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-whs-dark-700">
                          <span className="text-gray-500 dark:text-gray-400">Max Log Entries</span>
                          <span className="text-gray-900 dark:text-white font-medium">5,000</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-whs-dark-700">
                          <span className="text-gray-500 dark:text-gray-400">Cache TTL</span>
                          <span className="text-gray-900 dark:text-white font-medium">48 hours</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-gray-500 dark:text-gray-400">Rate Limit</span>
                          <span className="text-gray-900 dark:text-white font-medium">10 req/min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-whs-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <ChatLogsTable token={token} />
          )}
        </>
      )}
    </div>
  )
}

export default AdminPanel

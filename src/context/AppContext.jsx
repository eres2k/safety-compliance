import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { translations } from '../data/locales'
import { lawData } from '../data/laws'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // Framework state (AT, DE, NL)
  const [framework, setFramework] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whs_framework') || 'DE'
    }
    return 'DE'
  })

  // Language state
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whs_language') || 'en'
    }
    return 'en'
  })

  // Theme state (dark/light)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_theme')
      if (saved) {
        return saved === 'dark'
      }
      // Default to dark mode
      return true
    }
    return true
  })

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_bookmarks')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  // Recent searches state
  const [recentSearches, setRecentSearches] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_recent_searches')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  // Audit Trail state - tracks law reviews
  const [auditTrail, setAuditTrail] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_audit_trail')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  // Saved Queries state
  const [savedQueries, setSavedQueries] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_saved_queries')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  // Offline cached laws
  const [offlineCache, setOfflineCache] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_offline_cache')
      return saved ? JSON.parse(saved) : { laws: [], lastUpdated: null }
    }
    return { laws: [], lastUpdated: null }
  })

  // Compliance status tracking
  const [complianceStatus, setComplianceStatus] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_compliance_status')
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  // Persist framework selection
  useEffect(() => {
    localStorage.setItem('whs_framework', framework)
  }, [framework])

  // Persist language selection
  useEffect(() => {
    localStorage.setItem('whs_language', language)
  }, [language])

  // Persist theme
  useEffect(() => {
    const root = window.document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('whs_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('whs_theme', 'light')
    }
  }, [isDark])

  // Persist bookmarks
  useEffect(() => {
    localStorage.setItem('whs_bookmarks', JSON.stringify(bookmarks))
  }, [bookmarks])

  // Persist recent searches
  useEffect(() => {
    localStorage.setItem('whs_recent_searches', JSON.stringify(recentSearches))
  }, [recentSearches])

  // Persist audit trail
  useEffect(() => {
    localStorage.setItem('whs_audit_trail', JSON.stringify(auditTrail))
  }, [auditTrail])

  // Persist saved queries
  useEffect(() => {
    localStorage.setItem('whs_saved_queries', JSON.stringify(savedQueries))
  }, [savedQueries])

  // Persist offline cache
  useEffect(() => {
    localStorage.setItem('whs_offline_cache', JSON.stringify(offlineCache))
  }, [offlineCache])

  // Persist compliance status
  useEffect(() => {
    localStorage.setItem('whs_compliance_status', JSON.stringify(complianceStatus))
  }, [complianceStatus])

  // Get current translations
  const t = useMemo(() => translations[language] || translations.en, [language])

  // Get current law data
  const laws = useMemo(() => lawData[framework] || lawData.DE, [framework])

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev)
  }, [])

  // Toggle bookmark
  const toggleBookmark = useCallback((sectionId) => {
    setBookmarks(prev =>
      prev.includes(sectionId)
        ? prev.filter(b => b !== sectionId)
        : [...prev, sectionId]
    )
  }, [])

  // Check if section is bookmarked
  const isBookmarked = useCallback((sectionId) => bookmarks.includes(sectionId), [bookmarks])

  // Add recent search
  const addRecentSearch = useCallback((term) => {
    if (!term.trim()) return
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== term)
      return [term, ...filtered].slice(0, 10)
    })
  }, [])

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
  }, [])

  // Audit Trail functions
  const addAuditEntry = useCallback((entry) => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      framework,
      ...entry
    }
    setAuditTrail(prev => [newEntry, ...prev].slice(0, 100)) // Keep last 100 entries
  }, [framework])

  const clearAuditTrail = useCallback(() => {
    setAuditTrail([])
  }, [])

  // Saved Queries functions
  const saveQuery = useCallback((query) => {
    const newQuery = {
      id: Date.now(),
      savedAt: new Date().toISOString(),
      framework,
      ...query
    }
    setSavedQueries(prev => [newQuery, ...prev].slice(0, 20)) // Keep 20 saved queries
  }, [framework])

  const removeQuery = useCallback((queryId) => {
    setSavedQueries(prev => prev.filter(q => q.id !== queryId))
  }, [])

  const clearSavedQueries = useCallback(() => {
    setSavedQueries([])
  }, [])

  // Offline cache functions
  const cacheLaw = useCallback((law) => {
    setOfflineCache(prev => {
      const existing = prev.laws.filter(l => l.id !== law.id)
      return {
        laws: [...existing, { ...law, cachedAt: new Date().toISOString() }].slice(0, 50),
        lastUpdated: new Date().toISOString()
      }
    })
  }, [])

  const removeCachedLaw = useCallback((lawId) => {
    setOfflineCache(prev => ({
      ...prev,
      laws: prev.laws.filter(l => l.id !== lawId)
    }))
  }, [])

  const isCached = useCallback((lawId) => {
    return offlineCache.laws.some(l => l.id === lawId)
  }, [offlineCache])

  const clearOfflineCache = useCallback(() => {
    setOfflineCache({ laws: [], lastUpdated: null })
  }, [])

  // Compliance status functions
  const updateComplianceStatus = useCallback((lawId, status) => {
    setComplianceStatus(prev => ({
      ...prev,
      [lawId]: {
        status, // 'compliant', 'partial', 'non-compliant', 'not-reviewed'
        updatedAt: new Date().toISOString(),
        framework
      }
    }))
  }, [framework])

  const getComplianceStatus = useCallback((lawId) => {
    return complianceStatus[lawId] || { status: 'not-reviewed', updatedAt: null }
  }, [complianceStatus])

  const getComplianceStats = useCallback(() => {
    const entries = Object.values(complianceStatus).filter(c => c.framework === framework)
    return {
      total: entries.length,
      compliant: entries.filter(c => c.status === 'compliant').length,
      partial: entries.filter(c => c.status === 'partial').length,
      nonCompliant: entries.filter(c => c.status === 'non-compliant').length,
      notReviewed: entries.filter(c => c.status === 'not-reviewed').length
    }
  }, [complianceStatus, framework])

  // Framework colors mapping
  const frameworkColors = useMemo(() => ({
    AT: {
      primary: '#ED2939',
      light: '#FEE2E2',
      dark: '#991b1b',
      name: 'Austria',
      code: 'AT',
      lawName: 'ASchG'
    },
    DE: {
      primary: '#FFCC00',
      light: '#FEF3C7',
      dark: '#a16207',
      name: 'Germany',
      code: 'DE',
      lawName: 'DGUV'
    },
    NL: {
      primary: '#FF6600',
      light: '#FFEDD5',
      dark: '#c2410c',
      name: 'Netherlands',
      code: 'NL',
      lawName: 'Arbowet'
    },
    WIKI: {
      primary: '#636466',
      light: '#F3F4F6',
      dark: '#374151',
      name: 'Wikipedia',
      code: 'WIKI',
      lawName: 'Reference'
    }
  }), [])

  const currentFrameworkColor = frameworkColors[framework]

  const value = {
    // Framework
    framework,
    setFramework,
    frameworkColors,
    currentFrameworkColor,
    // Language
    language,
    setLanguage,
    t,
    // Theme
    isDark,
    theme: isDark ? 'dark' : 'light',
    toggleTheme,
    // Laws
    laws,
    // Bookmarks
    bookmarks,
    toggleBookmark,
    isBookmarked,
    // Recent searches
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    // Audit Trail
    auditTrail,
    addAuditEntry,
    clearAuditTrail,
    // Saved Queries
    savedQueries,
    saveQuery,
    removeQuery,
    clearSavedQueries,
    // Offline Cache
    offlineCache,
    cacheLaw,
    removeCachedLaw,
    isCached,
    clearOfflineCache,
    // Compliance Status
    complianceStatus,
    updateComplianceStatus,
    getComplianceStatus,
    getComplianceStats
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

export default AppContext

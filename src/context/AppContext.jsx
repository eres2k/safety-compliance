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
    clearRecentSearches
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

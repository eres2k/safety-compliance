import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { translations } from '../data/locales'
import { lawData } from '../data/laws'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [framework, setFramework] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whs_framework') || 'DE'
    }
    return 'DE'
  })

  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whs_language') || 'en'
    }
    return 'en'
  })

  const [bookmarks, setBookmarks] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('whs_bookmarks')
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

  // Persist bookmarks
  useEffect(() => {
    localStorage.setItem('whs_bookmarks', JSON.stringify(bookmarks))
  }, [bookmarks])

  // Get current translations
  const t = useMemo(() => translations[language] || translations.en, [language])

  // Get current law data
  const laws = useMemo(() => lawData[framework] || lawData.DE, [framework])

  // Toggle bookmark
  const toggleBookmark = (sectionId) => {
    setBookmarks(prev =>
      prev.includes(sectionId)
        ? prev.filter(b => b !== sectionId)
        : [...prev, sectionId]
    )
  }

  // Check if section is bookmarked
  const isBookmarked = (sectionId) => bookmarks.includes(sectionId)

  const value = {
    framework,
    setFramework,
    language,
    setLanguage,
    t,
    laws,
    bookmarks,
    toggleBookmark,
    isBookmarked
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

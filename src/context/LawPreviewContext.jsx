import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { getAllLaws, getAllLawsSync } from '../services/euLawsDatabase'

const LawPreviewContext = createContext(null)

// WHS Topic labels (copied from LawBrowser for consistency)
const WHS_TOPIC_LABELS = {
  'general-safety': { label: 'General Safety', icon: '🛡️' },
  'hazard-assessment': { label: 'Hazard Assessment', icon: '⚠️' },
  'workplace-design': { label: 'Workplace Design', icon: '🏗️' },
  'ergonomics': { label: 'Ergonomics', icon: '🪑' },
  'manual-handling': { label: 'Manual Handling', icon: '📦' },
  'machinery-safety': { label: 'Machinery Safety', icon: '⚙️' },
  'chemical-safety': { label: 'Chemical Safety', icon: '🧪' },
  'fire-safety': { label: 'Fire Safety', icon: '🔥' },
  'electrical-safety': { label: 'Electrical Safety', icon: '⚡' },
  'fall-protection': { label: 'Fall Protection', icon: '🪜' },
  'ppe': { label: 'PPE', icon: '🦺' },
  'emergency-response': { label: 'Emergency Response', icon: '🚨' },
  'first-aid': { label: 'First Aid', icon: '🏥' },
  'training': { label: 'Training', icon: '📚' },
  'documentation': { label: 'Documentation', icon: '📋' },
  'work-hours': { label: 'Work Hours', icon: '⏰' },
  'young-workers': { label: 'Young Workers', icon: '👶' },
  'pregnant-workers': { label: 'Pregnant Workers', icon: '🤰' },
  'noise': { label: 'Noise', icon: '🔊' },
  'vibration': { label: 'Vibration', icon: '📳' },
  'lighting': { label: 'Lighting', icon: '💡' },
  'ventilation': { label: 'Ventilation', icon: '🌬️' },
  'temperature': { label: 'Temperature', icon: '🌡️' },
  'hygiene': { label: 'Hygiene', icon: '🧼' },
  'contractor-safety': { label: 'Contractor Safety', icon: '👷' },
  'transport-safety': { label: 'Transport Safety', icon: '🚚' },
  'loading-dock': { label: 'Loading Dock', icon: '🚛' }
}

export function LawPreviewProvider({ children }) {
  // Preview state
  const [preview, setPreview] = useState({
    open: false,
    section: null,
    lawInfo: null,
    x: 0,
    y: 0
  })

  // Laws cache for lookup
  const [lawsCache, setLawsCache] = useState({
    AT: null,
    DE: null,
    NL: null
  })

  // Timeout ref for hover delay
  const previewTimeoutRef = useRef(null)

  // Load laws for a country if not cached
  const loadLawsForCountry = useCallback(async (country) => {
    if (lawsCache[country]) return lawsCache[country]

    try {
      const laws = await getAllLaws(country)
      setLawsCache(prev => ({ ...prev, [country]: laws }))
      return laws
    } catch (error) {
      console.error(`Failed to load laws for ${country}:`, error)
      return []
    }
  }, [lawsCache])

  // Get all loaded laws from cache
  const getAllLoadedLaws = useCallback(() => {
    return [
      ...(lawsCache.AT || []),
      ...(lawsCache.DE || []),
      ...(lawsCache.NL || [])
    ]
  }, [lawsCache])

  // Find section content from law data
  const findSectionContent = useCallback((lawInfo, allLaws) => {
    if (!lawInfo || !lawInfo.section) return null

    let targetLaw = null

    // Find the law by abbreviation
    if (lawInfo.law) {
      targetLaw = allLaws.find(law =>
        law.abbreviation?.toLowerCase() === lawInfo.law.toLowerCase() ||
        law.abbr?.toLowerCase() === lawInfo.law.toLowerCase()
      )
    }

    if (!targetLaw || !targetLaw.chapters) return null

    // Search through chapters for the section
    const isNLLaw = targetLaw.jurisdiction === 'NL'
    const sectionNum = lawInfo.section.replace(/[§\s]/g, '').replace(/^Artikel/i, '')

    for (const chapter of targetLaw.chapters) {
      if (chapter.sections) {
        for (const section of chapter.sections) {
          const secNum = section.number?.replace(/[§\s]/g, '').replace(/^Artikel/i, '')
          if (secNum === sectionNum) {
            const displayNumber = section.number?.startsWith('§') || section.number?.startsWith('Artikel')
              ? section.number
              : isNLLaw ? `Artikel ${section.number}` : `§ ${section.number}`

            return {
              id: section.id,
              number: displayNumber,
              title: section.title,
              content: section.text || section.content,
              whs_topics: section.whs_topics,
              lawTitle: targetLaw.title,
              lawAbbr: targetLaw.abbreviation || targetLaw.abbr
            }
          }
        }
      }
    }

    return null
  }, [])

  // Show preview on hover
  const showPreview = useCallback(async (e, lawInfo) => {
    if (!lawInfo) return

    // Clear any pending timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
    }

    // Capture rect synchronously
    const target = e.currentTarget
    if (!target) return
    const rect = target.getBoundingClientRect()

    // Determine which country's laws to load
    let country = lawInfo.country
    if (!country && lawInfo.law) {
      // Determine country from law abbreviation
      const dutchLaws = ['Arbowet', 'Arbobesluit', 'Arboregeling', 'ATW', 'WAB', 'BW', 'WOR']
      const austrianLaws = ['ASchG', 'ArbIG', 'AZG', 'KSchG', 'ARG', 'KJBG', 'MSchG', 'GlBG', 'AVRAG', 'BauKG', 'AM-VO', 'AStV']

      if (dutchLaws.some(l => l.toLowerCase() === lawInfo.law.toLowerCase())) {
        country = 'NL'
      } else if (austrianLaws.some(l => l.toLowerCase() === lawInfo.law.toLowerCase())) {
        country = 'AT'
      } else {
        country = 'DE'
      }
    }

    // Set a delay before showing the preview
    previewTimeoutRef.current = setTimeout(async () => {
      // Load laws if needed
      if (country && !lawsCache[country]) {
        await loadLawsForCountry(country)
      }

      const allLoadedLaws = getAllLoadedLaws()
      const sectionContent = findSectionContent(lawInfo, allLoadedLaws)

      if (sectionContent) {
        setPreview({
          open: true,
          section: sectionContent,
          lawInfo,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8
        })
      }
    }, 300)
  }, [lawsCache, loadLawsForCountry, getAllLoadedLaws, findSectionContent])

  // Hide preview
  const hidePreview = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
    }
  }, [])

  // Close preview
  const closePreview = useCallback(() => {
    setPreview({
      open: false,
      section: null,
      lawInfo: null,
      x: 0,
      y: 0
    })
  }, [])

  // Pre-load laws for common countries
  useEffect(() => {
    // Pre-load DE laws as they're most common
    loadLawsForCountry('DE')
  }, [loadLawsForCountry])

  const value = {
    preview,
    showPreview,
    hidePreview,
    closePreview,
    loadLawsForCountry,
    getAllLoadedLaws,
    lawsCache,
    WHS_TOPIC_LABELS
  }

  return (
    <LawPreviewContext.Provider value={value}>
      {children}
    </LawPreviewContext.Provider>
  )
}

export function useLawPreview() {
  const context = useContext(LawPreviewContext)
  if (!context) {
    throw new Error('useLawPreview must be used within a LawPreviewProvider')
  }
  return context
}

export default LawPreviewContext

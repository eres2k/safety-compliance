import { useRef, useEffect } from 'react'
import { useLawPreview } from '../../context/LawPreviewContext'
import { useApp } from '../../context/AppContext'

/**
 * Global Law Preview Modal
 * Shows a preview popup when hovering over law references anywhere on the site
 */
export function LawPreviewModal() {
  const { preview, closePreview, hidePreview, WHS_TOPIC_LABELS } = useLawPreview()
  const { t } = useApp()
  const timeoutRef = useRef(null)

  // Handle mouse enter on the popup itself - keep it open
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  // Handle mouse leave from popup - close after delay
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      closePreview()
    }, 150)
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (!preview.open || !preview.section) {
    return null
  }

  // Calculate safe position to keep popup on screen
  const safeX = Math.min(Math.max(preview.x, 220), typeof window !== 'undefined' ? window.innerWidth - 220 : 500)
  const safeY = Math.min(preview.y, typeof window !== 'undefined' ? window.innerHeight - 340 : 400)

  return (
    <div
      className="law-ref-preview-popup fixed z-[9999] bg-white dark:bg-whs-dark-800 rounded-lg shadow-2xl border border-blue-200 dark:border-blue-800 max-w-md max-h-80 overflow-hidden"
      style={{
        left: safeX,
        top: safeY,
        transform: 'translateX(-50%)'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="font-bold text-sm">{preview.section.number}</span>
          {preview.section.title && (
            <span className="text-sm opacity-90 truncate">{preview.section.title}</span>
          )}
        </div>
        <button
          onClick={closePreview}
          className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Law name badge if from different law */}
      {preview.section.lawAbbr && (
        <div className="px-4 pt-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-whs-dark-700 text-gray-700 dark:text-gray-300">
            {preview.section.lawAbbr}
          </span>
        </div>
      )}

      {/* Content Preview */}
      <div className="p-4 overflow-y-auto max-h-48">
        {/* WHS Topics */}
        {preview.section.whs_topics && preview.section.whs_topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {preview.section.whs_topics.slice(0, 3).map(topic => {
              const topicId = typeof topic === 'object' ? topic.id : topic
              return (
                <span
                  key={topicId}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                >
                  {WHS_TOPIC_LABELS[topicId]?.label || topicId}
                </span>
              )
            })}
          </div>
        )}

        {/* Full paragraph content */}
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {preview.section.content ? (
            <p className="whitespace-pre-wrap line-clamp-6">
              {preview.section.content}
            </p>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 italic">
              {t?.lawBrowser?.noContentPreview || 'No content available'}
            </p>
          )}
        </div>
      </div>

      {/* Footer - Click to navigate hint */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-whs-dark-700 border-t border-gray-100 dark:border-whs-dark-600">
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          {t?.lawBrowser?.clickToNavigate || 'Click to navigate to this section'}
        </p>
      </div>
    </div>
  )
}

export default LawPreviewModal

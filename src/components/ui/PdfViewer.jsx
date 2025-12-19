import { useState, useEffect } from 'react'

/**
 * PDF Viewer Component
 * Displays PDFs inline using iframe or provides download link as fallback
 */
export function PdfViewer({
  url,
  title = 'PDF Document',
  onClose,
  isModal = false,
  className = ''
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('embedded') // 'embedded' | 'external'

  useEffect(() => {
    // Reset state when URL changes
    setLoading(true)
    setError(null)
  }, [url])

  const handleIframeLoad = () => {
    setLoading(false)
  }

  const handleIframeError = () => {
    setLoading(false)
    setError('PDF could not be loaded. Try opening in a new tab.')
    setViewMode('external')
  }

  const openInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!url) {
    return null
  }

  const content = (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-whs-dark-700 border-b border-gray-200 dark:border-whs-dark-600">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <span className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-xs">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <button
            onClick={openInNewTab}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-whs-dark-600 rounded transition-colors"
            title="Open in new tab"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            New Tab
          </button>

          <a
            href={url}
            download
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-whs-dark-600 rounded transition-colors"
            title="Download PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative bg-gray-200 dark:bg-whs-dark-800">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-whs-dark-800">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-whs-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading PDF...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-6">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={openInNewTab}
                className="px-4 py-2 bg-whs-orange-500 text-white rounded-lg hover:bg-whs-orange-600 transition-colors"
              >
                Open PDF in New Tab
              </button>
            </div>
          </div>
        ) : (
          <iframe
            src={url}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={title}
          />
        )}
      </div>
    </div>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-whs-dark-800 rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-6xl overflow-hidden">
          {content}
        </div>
      </div>
    )
  }

  return content
}

/**
 * PDF Source Badge
 * Shows when a law has PDF source available
 */
export function PdfSourceBadge({ law, onClick, isSupplementary = false }) {
  if (!law?.source?.pdf_url && !law?.source?.source_type?.includes('pdf')) {
    return null
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
        isSupplementary
          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
      }`}
      title={isSupplementary ? 'View supplementary PDF document' : 'View official PDF source'}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
      {isSupplementary ? 'Supplement' : 'PDF'}
    </button>
  )
}

/**
 * Supplementary Source Badge
 * Indicates content from AUVA Merkblätter, DGUV publications, etc.
 */
export function SupplementaryBadge({ sourceType, className = '' }) {
  const badges = {
    // Austria
    auva: { label: 'AUVA Merkblatt', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    merkblatt: { label: 'AUVA Merkblatt', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    // Germany
    dguv: { label: 'DGUV', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
    trbs: { label: 'TRBS', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
    trgs: { label: 'TRGS', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
    asr: { label: 'ASR', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
    // Netherlands
    pgs: { label: 'PGS', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
    ai: { label: 'AI Publication', color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' },
    // Default
    default: { label: 'Supplement', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' }
  }

  const badge = badges[sourceType] || badges.default

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.color} ${className}`}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
      </svg>
      {badge.label}
    </span>
  )
}

export default PdfViewer

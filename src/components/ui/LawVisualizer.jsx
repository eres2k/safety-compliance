import { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'

// Initialize mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
    padding: 15
  },
  themeVariables: {
    primaryColor: '#f97316',
    primaryTextColor: '#1f2937',
    primaryBorderColor: '#ea580c',
    lineColor: '#6b7280',
    secondaryColor: '#fef3c7',
    tertiaryColor: '#f3f4f6'
  }
})

// Clean up mermaid syntax from AI response
function cleanMermaidSyntax(rawSyntax) {
  if (!rawSyntax) return null

  let cleaned = rawSyntax.trim()

  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```mermaid\s*/i, '')
  cleaned = cleaned.replace(/^```\s*/i, '')
  cleaned = cleaned.replace(/\s*```$/i, '')

  // Ensure it starts with graph directive
  if (!cleaned.match(/^(graph|flowchart)\s+(TD|TB|LR|RL|BT)/i)) {
    // Try to find graph directive in the text
    const graphMatch = cleaned.match(/(graph|flowchart)\s+(TD|TB|LR|RL|BT)/i)
    if (graphMatch) {
      cleaned = cleaned.substring(cleaned.indexOf(graphMatch[0]))
    } else {
      // Default to graph TD if no directive found
      cleaned = 'graph TD\n' + cleaned
    }
  }

  // Fix common issues with AI-generated mermaid
  // Escape special characters in node labels
  const lines = cleaned.split('\n')
  const fixedLines = lines.map(line => {
    // Don't modify the graph directive line
    if (line.match(/^(graph|flowchart)\s+/i)) return line

    // Fix parentheses in labels that aren't part of node syntax
    // Replace "text (note)" with "text - note" inside node labels
    // BUT preserve valid Mermaid double-paren syntax like A((Start)) for stadium/circle nodes
    line = line.replace(/\[([^\]]*)\(([^)]+)\)([^\]]*)\]/g, '[$1- $2$3]')
    // Only fix nested parens inside rounded nodes if there's text before the inner paren
    // This preserves ((text)) stadium nodes but fixes "A(text (note))" patterns
    line = line.replace(/\(([^()]+)\(([^)]+)\)([^)]*)\)/g, '($1- $2$3)')
    line = line.replace(/\{([^}]*)\(([^)]+)\)([^}]*)\}/g, '{$1- $2$3}')

    return line
  })

  return fixedLines.join('\n')
}

export function LawVisualizer({ chartSyntax, onClose, title }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [svgContent, setSvgContent] = useState(null)
  const [isZoomed, setIsZoomed] = useState(false)

  const renderChart = useCallback(async () => {
    if (!chartSyntax || !containerRef.current) return

    try {
      setError(null)
      const cleanedSyntax = cleanMermaidSyntax(chartSyntax)

      if (!cleanedSyntax) {
        setError('Invalid flowchart syntax received')
        return
      }

      // Generate unique ID for this render
      const id = `mermaid-${Date.now()}`

      // Render the mermaid diagram
      const { svg } = await mermaid.render(id, cleanedSyntax)
      setSvgContent(svg)
    } catch (err) {
      console.error('Mermaid render error:', err)
      setError(`Failed to render flowchart: ${err.message || 'Invalid syntax'}`)
    }
  }, [chartSyntax])

  useEffect(() => {
    renderChart()
  }, [renderChart])

  // Toggle zoom
  const toggleZoom = () => setIsZoomed(!isZoomed)

  if (error) {
    return (
      <div className="relative p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-red-800 dark:text-red-300">Flowchart Error</h4>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer hover:text-red-600">Show raw syntax</summary>
              <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                {chartSyntax}
              </pre>
            </details>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 overflow-hidden transition-all ${isZoomed ? 'fixed inset-4 z-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-whs-orange-50 to-amber-50 dark:from-whs-orange-900/20 dark:to-amber-900/20 border-b border-gray-200 dark:border-whs-dark-700">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-whs-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {title || 'Visual Law Flowchart'}
          </h4>
          <span className="px-2 py-0.5 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 text-xs rounded-full">
            Auto Generated
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleZoom}
            className="p-1.5 text-gray-500 hover:text-whs-orange-500 hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20 rounded-lg transition-colors"
            title={isZoomed ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isZoomed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={containerRef}
        className={`p-4 overflow-auto ${isZoomed ? 'h-[calc(100%-60px)]' : 'max-h-[500px]'}`}
      >
        {svgContent ? (
          <div
            className="flex justify-center items-start min-w-full"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="flex items-center justify-center h-40">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <div className="w-8 h-8 border-3 border-whs-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Rendering flowchart...</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-whs-dark-900 border-t border-gray-100 dark:border-whs-dark-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Follow the decision tree to understand compliance requirements. Click fullscreen for better viewing.
        </p>
      </div>

      {/* Backdrop for zoomed mode */}
      {isZoomed && (
        <div
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={toggleZoom}
        />
      )}
    </div>
  )
}

export default LawVisualizer

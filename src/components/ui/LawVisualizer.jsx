import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

// Initialize mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#f97316',
    primaryTextColor: '#fff',
    primaryBorderColor: '#ea580c',
    lineColor: '#6b7280',
    secondaryColor: '#fef3c7',
    tertiaryColor: '#f3f4f6',
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 15
  },
  securityLevel: 'loose'
})

export function LawVisualizer({ chartSyntax, isLoading, error, onRetry }) {
  const containerRef = useRef(null)
  const [renderError, setRenderError] = useState(null)
  const [svgContent, setSvgContent] = useState('')

  useEffect(() => {
    if (!chartSyntax || !containerRef.current) return

    const renderChart = async () => {
      try {
        setRenderError(null)
        // Generate unique ID for this render
        const id = `mermaid-${Date.now()}`

        // Validate and render the mermaid chart
        const { svg } = await mermaid.render(id, chartSyntax)
        setSvgContent(svg)
      } catch (err) {
        console.error('Mermaid render error:', err)
        setRenderError(err.message || 'Failed to render flowchart')
      }
    }

    renderChart()
  }, [chartSyntax])

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-whs-orange-500 border-t-transparent" />
          <span className="text-gray-600 dark:text-gray-400">Generating flowchart...</span>
        </div>
      </div>
    )
  }

  if (error || renderError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Flowchart Error</span>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error || renderError}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-sm bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    )
  }

  if (!chartSyntax) {
    return null
  }

  return (
    <div className="p-4 bg-white dark:bg-whs-dark-800 rounded-xl border border-gray-200 dark:border-whs-dark-700 overflow-x-auto">
      <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span>Decision Flow Diagram</span>
      </div>
      <div
        ref={containerRef}
        className="flex justify-center min-h-[200px] [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )
}

export default LawVisualizer

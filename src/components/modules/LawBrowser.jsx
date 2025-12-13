import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Input, Card, CardContent } from '../ui'

function highlightText(text, term) {
  if (!term) return text
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark> : part
  )
}

export function LawBrowser({ onBack }) {
  const { t, laws, isBookmarked, toggleBookmark } = useApp()
  const { explainSection, isLoading } = useAI()

  const [searchTerm, setSearchTerm] = useState('')
  const [expandedSections, setExpandedSections] = useState([])
  const [selectedSection, setSelectedSection] = useState(null)
  const [explanation, setExplanation] = useState('')

  const toggleSection = (id) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const handleExplain = async () => {
    if (!selectedSection) return
    try {
      const response = await explainSection(selectedSection)
      setExplanation(response)
    } catch (error) {
      setExplanation(t.api.error)
    }
  }

  const filteredSections = useMemo(() => {
    if (!searchTerm) return laws.sections
    const term = searchTerm.toLowerCase()
    return laws.sections.map(part => ({
      ...part,
      sections: part.sections.filter(s =>
        s.title.toLowerCase().includes(term) ||
        s.content.toLowerCase().includes(term) ||
        (s.keywords && s.keywords.some(k => k.toLowerCase().includes(term)))
      )
    })).filter(part => part.sections.length > 0)
  }, [laws.sections, searchTerm])

  return (
    <div className="fade-in">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
      >
        ← {t.common.back}
      </button>

      <h2 className="text-2xl font-bold mb-2">{t.modules.lawBrowser.title}</h2>
      <p className="text-gray-600 mb-4">{laws.name}</p>

      <div className="mb-6">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.common.searchPlaceholder}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Law Tree */}
        <Card className="max-h-[600px] overflow-y-auto">
          <CardContent>
            {filteredSections.map(part => (
              <div key={part.id} className="mb-2">
                <button
                  onClick={() => toggleSection(part.id)}
                  className="w-full text-left px-3 py-2 bg-gray-100 rounded-lg font-medium flex items-center justify-between hover:bg-gray-200"
                >
                  <span>{highlightText(part.title, searchTerm)}</span>
                  <span>{expandedSections.includes(part.id) ? '−' : '+'}</span>
                </button>
                {expandedSections.includes(part.id) && (
                  <div className="ml-4 mt-2 space-y-1">
                    {part.sections.map(section => (
                      <button
                        key={section.id}
                        onClick={() => {
                          setSelectedSection(section)
                          setExplanation('')
                        }}
                        className={`
                          w-full text-left px-3 py-2 rounded
                          flex items-center justify-between
                          hover:bg-gray-100 transition-colors
                          ${selectedSection?.id === section.id ? 'bg-blue-100' : ''}
                        `}
                      >
                        <span className="text-sm">{highlightText(section.title, searchTerm)}</span>
                        {isBookmarked(section.id) && <span className="text-yellow-500">★</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filteredSections.length === 0 && (
              <p className="text-gray-500 text-center py-8">{t.common.noResults}</p>
            )}
          </CardContent>
        </Card>

        {/* Section Detail */}
        <Card>
          <CardContent>
            {selectedSection ? (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold">{selectedSection.title}</h3>
                  <button
                    onClick={() => toggleBookmark(selectedSection.id)}
                    className="text-2xl hover:scale-110 transition-transform"
                    aria-label={isBookmarked(selectedSection.id) ? 'Remove bookmark' : 'Add bookmark'}
                  >
                    {isBookmarked(selectedSection.id) ? '★' : '☆'}
                  </button>
                </div>
                <p className="text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap">
                  {highlightText(selectedSection.content, searchTerm)}
                </p>

                {selectedSection.keywords && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {selectedSection.keywords.map((keyword, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleExplain}
                  loading={isLoading}
                  disabled={isLoading}
                >
                  ✨ {t.common.explain}
                </Button>

                {explanation && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">AI Explanation</h4>
                    <p className="text-gray-700 whitespace-pre-wrap text-sm">{explanation}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Select a section to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default LawBrowser

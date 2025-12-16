import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Input, Select, Card, CardContent } from '../ui'
import { LoadingSpinner, DotsLoading } from '../ui/LoadingSpinner'
import { searchLaws, getLawsByTopic } from '../../services/euLawsDatabase'

const COMPANY_SIZES = ['1-10', '11-50', '51-100', '101-250', '250+']

// Recent search item component
const RecentSearchItem = ({ search, onClick }) => (
  <button
    onClick={() => onClick(search)}
    className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-whs-dark-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-whs-dark-600 transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {search}
  </button>
)

export function RegulationLookup({ onBack }) {
  const { t, framework, currentFrameworkColor, recentSearches, addRecentSearch } = useApp()
  const { lookupRegulation, isLoading } = useAI()

  const [topic, setTopic] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [result, setResult] = useState('')
  const [relatedLaws, setRelatedLaws] = useState([])
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('result')

  const handleLookup = async () => {
    if (!topic) return

    // Add to recent searches
    addRecentSearch?.(topic)

    try {
      const response = await lookupRegulation(topic, companySize)
      setResult(response)

      // Find related laws from database
      const searchResult = searchLaws(topic, { country: framework, limit: 6 })
      setRelatedLaws(searchResult.results || [])
    } catch (error) {
      setResult(t.api?.error || 'Failed to lookup regulation')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sizeOptions = [
    { value: '', label: 'Any size' },
    ...COMPANY_SIZES.map(size => ({
      value: size,
      label: `${size} ${t.common.employees}`
    }))
  ]

  const quickTopics = Object.values(t.topics)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {t.common.back}
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-full border border-purple-500/20">
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Smart Search</span>
        </div>
      </div>

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.modules.regulationLookup.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Search {currentFrameworkColor?.lawName || framework} regulations by topic
            </p>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <Card variant="glass" className="mb-6 animate-fade-in-up">
        <CardContent className="p-6">
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t.compliance.queryPrompt}</p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.common.topic} <span className="text-whs-danger-500">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., First Aid, Fire Extinguishers, PPE, Risk Assessment..."
                  className="pl-10"
                  variant="glass"
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.common.companySize} <span className="text-gray-400">({t.common.optional})</span>
              </label>
              <Select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                options={sizeOptions}
                variant="glass"
              />
            </div>
          </div>

          <Button
            onClick={handleLookup}
            loading={isLoading}
            disabled={isLoading || !topic}
            variant="primary"
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="white" />
                Searching Regulations...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {t.common.lookup}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Topics */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-medium">
          {t.compliance.quickTopics}
        </p>
        <div className="flex flex-wrap gap-2">
          {quickTopics.map((topicName, i) => (
            <button
              key={i}
              onClick={() => setTopic(topicName)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-whs-dark-800 rounded-full border border-gray-200 dark:border-whs-dark-700 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-500/50 hover:text-purple-600 dark:hover:text-purple-400 transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              {topicName}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Searches */}
      {recentSearches?.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-medium">
            Recent Searches
          </p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.slice(0, 5).map((search, i) => (
              <RecentSearchItem key={i} search={search} onClick={setTopic} />
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card variant="glass" className="mb-6">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                  <LoadingSpinner size="lg" color="orange" />
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                Searching regulations for "{topic}"...
              </p>
              <DotsLoading />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !isLoading && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-whs-dark-700">
            <button
              onClick={() => setActiveTab('result')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'result'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              AI Response
            </button>
            {relatedLaws.length > 0 && (
              <button
                onClick={() => setActiveTab('laws')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'laws'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Related Laws ({relatedLaws.length})
              </button>
            )}
          </div>

          {activeTab === 'result' && (
            <Card variant="elevated" className="overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Requirements for: {topic}</h3>
                      <p className="text-white/70 text-sm">{currentFrameworkColor?.lawName || framework} Regulations</p>
                    </div>
                  </div>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={handleCopy}
                    className="!bg-white/20 !text-white hover:!bg-white/30"
                  >
                    {copied ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {t.common.copied}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t.common.copy}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-whs-dark-800/50 p-4 rounded-xl max-h-[500px] overflow-y-auto font-sans border border-gray-100 dark:border-whs-dark-700">
                    {result}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'laws' && relatedLaws.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {relatedLaws.map((law, index) => (
                <Card
                  key={law.id || index}
                  variant="elevated"
                  className="hover:shadow-lg transition-all hover:-translate-y-1 animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                          {law.name || law.title}
                        </h4>
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                          {law.reference || law.id}
                        </p>
                        {law.description && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {law.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !isLoading && (
        <Card variant="glass" className="text-center py-12">
          <CardContent>
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Search Regulations
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Enter a safety topic above to search {currentFrameworkColor?.lawName || framework} regulations. Use quick topics for common searches or type your own query.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default RegulationLookup

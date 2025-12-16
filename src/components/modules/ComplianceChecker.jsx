import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Select, Card, CardContent, FormattedAIResponse } from '../ui'
import { LoadingSpinner, DotsLoading } from '../ui/LoadingSpinner'
import { searchLaws, getRelatedLaws } from '../../services/euLawsDatabase'

const COMPANY_SIZES = ['1-10', '11-50', '51-100', '101-250', '250+']

// Compliance status indicators
const ComplianceIndicator = ({ status }) => {
  const statusConfig = {
    compliant: {
      color: 'bg-whs-success-500',
      text: 'Compliant',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    partial: {
      color: 'bg-whs-yellow-500',
      text: 'Partial',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    nonCompliant: {
      color: 'bg-whs-danger-500',
      text: 'Action Required',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    }
  }

  const config = statusConfig[status] || statusConfig.partial

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-medium ${config.color}`}>
      {config.icon}
      {config.text}
    </div>
  )
}

export function ComplianceChecker({ onBack }) {
  const { t, framework, currentFrameworkColor } = useApp()
  const { checkCompliance, isLoading } = useAI()

  const [companySize, setCompanySize] = useState('')
  const industry = 'Delivery Last Mile Logistics' // Fixed for Amazon MEU WHS
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState('')
  const [relatedLaws, setRelatedLaws] = useState([])
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('result')

  const handleCheck = async () => {
    if (!companySize || !topic) {
      return
    }

    try {
      const response = await checkCompliance(companySize, industry, topic)
      setResult(response)

      // Find related laws from our database
      const searchResult = searchLaws(topic, { country: framework, limit: 5 })
      setRelatedLaws(searchResult.results || [])
    } catch (error) {
      setResult(t.api?.error || 'Failed to check compliance')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const topicOptions = Object.entries(t.topics).map(([key, value]) => ({
    value,
    label: value
  }))

  const sizeOptions = COMPANY_SIZES.map(size => ({
    value: size,
    label: `${size} ${t.common.employees}`
  }))

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

        <div className="flex items-center gap-2 px-3 py-1.5 bg-whs-success-500/10 dark:bg-whs-success-500/20 rounded-full border border-whs-success-500/20">
          <div className="w-2 h-2 bg-whs-success-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-whs-success-600 dark:text-whs-success-400">Compliance Tool</span>
        </div>
      </div>

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-whs-success-500 to-whs-success-600 flex items-center justify-center shadow-lg shadow-whs-success-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.modules.complianceChecker.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Check your workplace safety compliance against {currentFrameworkColor?.lawName || framework} regulations
            </p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <Card variant="glass" className="mb-6 animate-fade-in-up">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.common.stationSize}
              </label>
              <Select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                options={sizeOptions}
                placeholder={t.common.selectOption}
                variant="glass"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.common.topic}
              </label>
              <Select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                options={topicOptions}
                placeholder={t.common.selectOption}
                variant="glass"
              />
            </div>
          </div>

          <Button
            onClick={handleCheck}
            loading={isLoading}
            disabled={isLoading || !companySize || !topic}
            variant="success"
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="white" />
                Analyzing Compliance...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Check Compliance
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card variant="glass" className="mb-6">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-whs-success-500/20 to-whs-success-600/20 flex items-center justify-center">
                  <LoadingSpinner size="lg" color="orange" />
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">Analyzing compliance requirements...</p>
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
                  ? 'border-whs-success-500 text-whs-success-600 dark:text-whs-success-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Compliance Report
            </button>
            {relatedLaws.length > 0 && (
              <button
                onClick={() => setActiveTab('laws')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'laws'
                    ? 'border-whs-success-500 text-whs-success-600 dark:text-whs-success-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Related Laws ({relatedLaws.length})
              </button>
            )}
          </div>

          {activeTab === 'result' && (
            <Card variant="elevated" className="overflow-hidden">
              <div className="bg-gradient-to-r from-whs-success-500 to-whs-success-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{t.compliance.requirements}</h3>
                      <p className="text-white/70 text-sm">{industry} • {companySize} employees</p>
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
                <div className="max-h-[500px] overflow-y-auto bg-gray-50 dark:bg-whs-dark-800/50 p-4 rounded-xl border border-gray-100 dark:border-whs-dark-700">
                  <FormattedAIResponse content={result} />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'laws' && relatedLaws.length > 0 && (
            <div className="space-y-4">
              {relatedLaws.map((law, index) => (
                <Card
                  key={law.id || index}
                  variant="elevated"
                  className="hover:shadow-lg transition-shadow animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-whs-success-500/10 to-whs-success-600/10 dark:from-whs-success-500/20 dark:to-whs-success-600/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-whs-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {law.name || law.title}
                            </h4>
                            <p className="text-sm text-whs-success-600 dark:text-whs-success-400 font-medium">
                              {law.reference || law.id}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-400">
                            {law.type || 'Law'}
                          </span>
                        </div>
                        {law.description && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
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
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-whs-success-500/10 to-whs-success-600/10 dark:from-whs-success-500/20 dark:to-whs-success-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-whs-success-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Ready to Check Compliance
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Select your delivery station size and safety topic above to get compliance guidance based on {currentFrameworkColor?.lawName || framework} regulations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ComplianceChecker

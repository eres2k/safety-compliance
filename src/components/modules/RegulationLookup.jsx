import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Input, Select, Card, CardContent } from '../ui'

const COMPANY_SIZES = ['1-10', '11-50', '51-100', '101-250', '250+']

export function RegulationLookup({ onBack }) {
  const { t } = useApp()
  const { lookupRegulation, isLoading } = useAI()

  const [topic, setTopic] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  const handleLookup = async () => {
    if (!topic) {
      alert('Please enter a topic')
      return
    }

    try {
      const response = await lookupRegulation(topic, companySize)
      setResult(response)
    } catch (error) {
      setResult(t.api.error)
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
    <div className="fade-in">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
      >
        ← {t.common.back}
      </button>

      <h2 className="text-2xl font-bold mb-6">{t.modules.regulationLookup.title}</h2>

      <Card className="mb-6">
        <CardContent>
          <p className="text-gray-600 mb-4">{t.compliance.queryPrompt}</p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Input
              label={`${t.common.topic} *`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., First Aid, Fire Extinguishers, PPE, Risk Assessment..."
            />
            <Select
              label={`${t.common.companySize} (${t.common.optional})`}
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              options={sizeOptions}
            />
          </div>

          <Button
            onClick={handleLookup}
            loading={isLoading}
            disabled={isLoading || !topic}
            className="w-full"
            size="lg"
          >
            🔍 {t.common.lookup}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Topic Buttons */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2">{t.compliance.quickTopics}</p>
        <div className="flex flex-wrap gap-2">
          {quickTopics.map((topicName, i) => (
            <button
              key={i}
              onClick={() => setTopic(topicName)}
              className="px-3 py-1 text-sm bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              {topicName}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <Card>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Requirements for: {topic}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? `✓ ${t.common.copied}` : `📋 ${t.common.copy}`}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-[500px] overflow-y-auto">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default RegulationLookup

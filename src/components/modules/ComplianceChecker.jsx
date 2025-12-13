import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Select, Card, CardContent } from '../ui'

const COMPANY_SIZES = ['1-10', '11-50', '51-100', '101-250', '250+']

export function ComplianceChecker({ onBack }) {
  const { t } = useApp()
  const { checkCompliance, isLoading } = useAI()

  const [companySize, setCompanySize] = useState('')
  const [industry, setIndustry] = useState('')
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCheck = async () => {
    if (!companySize || !industry || !topic) {
      alert('Please fill in all fields')
      return
    }

    try {
      const response = await checkCompliance(companySize, industry, topic)
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

  const industryOptions = Object.entries(t.industries).map(([key, value]) => ({
    value,
    label: value
  }))

  const topicOptions = Object.entries(t.topics).map(([key, value]) => ({
    value,
    label: value
  }))

  const sizeOptions = COMPANY_SIZES.map(size => ({
    value: size,
    label: `${size} ${t.common.employees}`
  }))

  return (
    <div className="fade-in">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
      >
        ← {t.common.back}
      </button>

      <h2 className="text-2xl font-bold mb-6">{t.modules.complianceChecker.title}</h2>

      <Card className="mb-6">
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Select
              label={t.common.companySize}
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              options={sizeOptions}
              placeholder={t.common.selectOption}
            />

            <Select
              label={t.common.industry}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              options={industryOptions}
              placeholder={t.common.selectOption}
            />

            <Select
              label={t.common.topic}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              options={topicOptions}
              placeholder={t.common.selectOption}
            />
          </div>

          <Button
            onClick={handleCheck}
            loading={isLoading}
            disabled={isLoading || !companySize || !industry || !topic}
            className="w-full"
            size="lg"
          >
            🔍 Check Compliance
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t.compliance.requirements}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? `✓ ${t.common.copied}` : `📋 ${t.common.copy}`}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ComplianceChecker

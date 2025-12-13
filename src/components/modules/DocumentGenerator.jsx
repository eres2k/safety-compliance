import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Input, Card, CardContent } from '../ui'

const TEMPLATES = {
  riskAssessment: {
    icon: '📋',
    fields: ['workplace', 'activity', 'department']
  },
  asaMeeting: {
    icon: '📅',
    fields: ['date', 'attendees', 'mainTopics']
  },
  committeeMinutes: {
    icon: '📝',
    fields: ['date', 'attendees', 'discussedItems']
  },
  inspectionChecklist: {
    icon: '✅',
    fields: ['workplace', 'inspectionType', 'area']
  },
  incidentReport: {
    icon: '⚠️',
    fields: ['date', 'location', 'description', 'injuredPerson']
  },
  trainingDoc: {
    icon: '🎓',
    fields: ['trainingType', 'date', 'participants', 'trainer']
  }
}

export function DocumentGenerator({ onBack }) {
  const { t } = useApp()
  const { generateDocument, isLoading } = useAI()

  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [inputs, setInputs] = useState({})
  const [generatedDoc, setGeneratedDoc] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!selectedTemplate) return

    const template = TEMPLATES[selectedTemplate]
    const templateName = t.documents[selectedTemplate]

    try {
      const response = await generateDocument(templateName, inputs)
      setGeneratedDoc(response)
    } catch (error) {
      setGeneratedDoc(t.api.error)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDoc)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([generatedDoc], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedTemplate}_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fade-in">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
      >
        ← {t.common.back}
      </button>

      <h2 className="text-2xl font-bold mb-6">{t.modules.documentGenerator.title}</h2>

      {/* Template Selection */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {Object.entries(TEMPLATES).map(([key, template]) => (
          <button
            key={key}
            onClick={() => {
              setSelectedTemplate(key)
              setInputs({})
              setGeneratedDoc('')
            }}
            className={`
              p-4 bg-white rounded-lg shadow-md text-left
              hover:shadow-lg transition-all
              ${selectedTemplate === key ? 'ring-2 ring-blue-500' : ''}
            `}
          >
            <span className="text-2xl">{template.icon}</span>
            <p className="mt-2 font-medium">{t.documents[key]}</p>
          </button>
        ))}
      </div>

      {/* Input Fields */}
      {selectedTemplate && (
        <Card className="mb-6">
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">{t.documents[selectedTemplate]}</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {TEMPLATES[selectedTemplate].fields.map(field => (
                <Input
                  key={field}
                  label={t.documentFields[field]}
                  value={inputs[field] || ''}
                  onChange={(e) => setInputs({ ...inputs, [field]: e.target.value })}
                />
              ))}
            </div>
            <Button
              onClick={handleGenerate}
              loading={isLoading}
              disabled={isLoading}
              variant="success"
              className="w-full"
              size="lg"
            >
              📄 {t.common.generate}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generated Document */}
      {generatedDoc && (
        <Card>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Generated Document</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                >
                  {copied ? `✓ ${t.common.copied}` : `📋 ${t.common.copy}`}
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownload}
                >
                  ⬇️ {t.common.download}
                </Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              {generatedDoc}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default DocumentGenerator

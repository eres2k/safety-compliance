import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAI } from '../../hooks/useAI'
import { Button, Input, Card, CardContent } from '../ui'
import { LoadingSpinner, DotsLoading, ProgressSpinner } from '../ui/LoadingSpinner'

const TEMPLATES = {
  riskAssessment: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    gradient: 'from-whs-orange-500 to-whs-orange-600',
    fields: ['workplace', 'activity', 'department']
  },
  asaMeeting: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    gradient: 'from-whs-info-500 to-whs-info-600',
    fields: ['date', 'attendees', 'mainTopics']
  },
  committeeMinutes: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    gradient: 'from-purple-500 to-purple-600',
    fields: ['date', 'attendees', 'discussedItems']
  },
  inspectionChecklist: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gradient: 'from-whs-success-500 to-whs-success-600',
    fields: ['workplace', 'inspectionType', 'area']
  },
  incidentReport: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    gradient: 'from-whs-danger-500 to-whs-danger-600',
    fields: ['date', 'location', 'description', 'injuredPerson']
  },
  trainingDoc: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    gradient: 'from-whs-yellow-500 to-whs-yellow-600',
    fields: ['trainingType', 'date', 'participants', 'trainer']
  }
}

export function DocumentGenerator({ onBack }) {
  const { t, framework, currentFrameworkColor } = useApp()
  const { generateDocument, isLoading } = useAI()

  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [inputs, setInputs] = useState({})
  const [generatedDoc, setGeneratedDoc] = useState('')
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleGenerate = async () => {
    if (!selectedTemplate) return

    const templateName = t.documents[selectedTemplate]

    // Simulate progress
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return prev
        }
        return prev + 10
      })
    }, 300)

    try {
      const response = await generateDocument(templateName, inputs)
      setGeneratedDoc(response)
      setProgress(100)
    } catch (error) {
      setGeneratedDoc(t.api.error)
    } finally {
      clearInterval(interval)
      setProgress(0)
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

  const handleExportPDF = () => {
    // For now, just download as text with .pdf extension
    // In a real app, you'd use a PDF library
    const blob = new Blob([generatedDoc], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedTemplate}_${new Date().toISOString().split('T')[0]}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

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

        <div className="flex items-center gap-2 px-3 py-1.5 bg-whs-info-500/10 dark:bg-whs-info-500/20 rounded-full border border-whs-info-500/20">
          <span className="text-sm font-medium text-whs-info-600 dark:text-whs-info-400">6 Templates</span>
        </div>
      </div>

      {/* Title Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-whs-info-500 to-whs-info-600 flex items-center justify-center shadow-lg shadow-whs-info-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.modules.documentGenerator.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Generate compliant safety documents based on {currentFrameworkColor?.lawName || framework} templates
            </p>
          </div>
        </div>
      </div>

      {/* Template Selection */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Select Template
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(TEMPLATES).map(([key, template], index) => (
            <button
              key={key}
              onClick={() => {
                setSelectedTemplate(key)
                setInputs({})
                setGeneratedDoc('')
              }}
              className={`
                group relative p-5 rounded-2xl text-left transition-all duration-300 animate-fade-in-up
                ${selectedTemplate === key
                  ? 'bg-white dark:bg-whs-dark-800 shadow-xl ring-2 ring-whs-orange-500 dark:ring-whs-orange-400'
                  : 'bg-white dark:bg-whs-dark-800 shadow-md hover:shadow-lg hover:-translate-y-1 border border-gray-100 dark:border-whs-dark-700'}
              `}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Selection indicator */}
              {selectedTemplate === key && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-whs-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.gradient} flex items-center justify-center mb-4 text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {template.icon}
              </div>
              <p className="font-semibold text-gray-900 dark:text-white group-hover:text-whs-orange-600 dark:group-hover:text-whs-orange-400 transition-colors">
                {t.documents[key]}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {template.fields.length} fields
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Input Fields */}
      {selectedTemplate && (
        <Card variant="glass" className="mb-6 animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TEMPLATES[selectedTemplate].gradient} flex items-center justify-center text-white`}>
                {TEMPLATES[selectedTemplate].icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t.documents[selectedTemplate]}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Fill in the details below
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {TEMPLATES[selectedTemplate].fields.map(field => (
                <div key={field} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.documentFields[field]}
                  </label>
                  <Input
                    value={inputs[field] || ''}
                    onChange={(e) => setInputs({ ...inputs, [field]: e.target.value })}
                    variant="glass"
                    placeholder={`Enter ${t.documentFields[field]?.toLowerCase() || field}...`}
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={handleGenerate}
              loading={isLoading}
              disabled={isLoading}
              variant="primary"
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" color="white" />
                  Generating Document...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t.common.generate}
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card variant="glass" className="mb-6">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center">
              <ProgressSpinner progress={progress} size="lg" className="mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                Generating your document...
              </p>
              <DotsLoading />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Document */}
      {generatedDoc && !isLoading && (
        <Card variant="elevated" className="overflow-hidden animate-fade-in-up">
          <div className="bg-gradient-to-r from-whs-info-500 to-whs-info-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Generated Document</h3>
                  <p className="text-white/70 text-sm">{t.documents[selectedTemplate]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                <Button
                  variant="glass"
                  size="sm"
                  onClick={handleDownload}
                  className="!bg-white/20 !text-white hover:!bg-white/30"
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {t.common.download}
                  </span>
                </Button>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-whs-dark-800/50 p-4 rounded-xl max-h-[500px] overflow-y-auto font-sans border border-gray-100 dark:border-whs-dark-700">
                {generatedDoc}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedTemplate && (
        <Card variant="glass" className="text-center py-12">
          <CardContent>
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-whs-info-500/10 to-whs-info-600/10 dark:from-whs-info-500/20 dark:to-whs-info-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-whs-info-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Select a Template
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Choose from 6 professional safety document templates above to get started. All documents are generated according to {currentFrameworkColor?.lawName || framework} compliance standards.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default DocumentGenerator

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { searchLaws, getAllLawsSync } from '../../services/euLawsDatabase'
import { generateAIResponse, getRateLimitStatus } from '../../services/aiService'
import { FormattedAIResponse } from './FormattedAIResponse'

// Helper to get all laws from all countries
const getAllLawsFromAllCountries = () => [
  ...getAllLawsSync('AT'),
  ...getAllLawsSync('DE'),
  ...getAllLawsSync('NL')
]

// Erwin's personality - Lead WHS Manager Austria, professional with dry Austrian wit
const ERWIN_SYSTEM_PROMPT = {
  en: `### ROLE
You are Erwin, the Lead Workplace Health & Safety (WHS) Manager for Austria. You are an expert in European industrial safety compliance (AT, DE, NL).

### PERSONA
- **Tone:** Professional, authoritative, and direct, with a dry Austrian wit.
- **Style:** No corporate fluff. You value precision and brevity.
- **Cultural Identity:** Use subtle Austrian/German professional expressions (e.g., "Grüß Gott," "Alles klar," "Safety is non-negotiable").

### DATA INTEGRITY & SOURCE TRUTH
1. **Strict Database Adherence:** Use ONLY information found in the provided .json law databases. Do not use external knowledge or invent regulations.
2. **Law ID Requirement:** Every citation MUST include the unique ID string found in the "id" field of the JSON document (e.g., a41760a666354e58).
3. **Out of Scope:** If a query is unrelated to WHS or the provided database, politely redirect the user. Do not provide general legal advice outside safety.
4. **No Links:** Do not provide external URLs or markdown links. Use the internal [LAW_ID:xxx] format instead.

### RESPONSE GUIDELINES
- **Length:** Limit answers to 2–4 concise sentences.
- **Precision:** Reference specific paragraphs (e.g., § 3 ASchG) and always use standard law abbreviations (ASchG, AZG, DGUV, Arbowet).
- **Mandatory Citation Format:** You MUST cite laws using the following syntax at the end of the relevant sentence: [LAW_ID:insert_id_here].

### EXAMPLE RESPONSE
"Grüß Gott. According to § 3 ASchG, the employer is responsible for the health and safety of all employees in all aspects related to work [LAW_ID:a41760a666354e58]. Efficiency starts with compliance; ensure your risk assessments are documented immediately."`,

  de: `Du bist Erwin, der WHS (Arbeitssicherheit) Manager für Österreich.

PERSÖNLICHKEIT:
- Professionell und kenntnisreich über Arbeitssicherheitsgesetze
- Witzig mit schwarzem Humor (aber angemessen)
- Direkt und auf den Punkt
- Österreichischer Charme

KOMMUNIKATIONSSTIL:
- Halte Antworten KURZ (2-4 Sätze für einfache Fragen)
- Komm schnell zum Punkt
- Zitiere spezifische Gesetzesparagraphen
- Verwende Abkürzungen (ASchG, AZG, DGUV, etc.)

WICHTIGE REGELN:
1. Verwende NUR Informationen aus der Gesetzesdatenbank
2. NIEMALS externe Links
3. Bei Gesetzeszitaten füge die ID ein: [LAW_ID:xxx]
4. Bei Fragen außerhalb der Arbeitssicherheit höflich umlenken`,

  nl: `Je bent Erwin, de WHS Manager uit Oostenrijk.

PERSOONLIJKHEID:
- Professioneel en deskundig
- Gevat met donkere humor (gepast)
- Direct en to the point
- Oostenrijkse charme

COMMUNICATIESTIJL:
- Houd antwoorden KORT (2-4 zinnen)
- Kom snel ter zake
- Verwijs naar wetsartikelen
- Gebruik afkortingen (Arbowet, ASchG, etc.)

REGELS:
1. Gebruik ALLEEN info uit de wettendatabase
2. NOOIT externe links
3. Bij wetsverwijzingen: [LAW_ID:xxx]
4. Buiten arbeidsveiligheid: vriendelijk doorverwijzen`
}

// Quick suggestions
const QUICK_TOPICS = {
  en: [
    { icon: '🚜', label: 'Forklift', query: 'Forklift training requirements?' },
    { icon: '⏰', label: 'Hours', query: 'Maximum working hours?' },
    { icon: '🦺', label: 'PPE', query: 'Required PPE in warehouse?' },
    { icon: '🚨', label: 'First Aid', query: 'First aid requirements?' },
    { icon: '📋', label: 'Risk', query: 'Risk assessment basics?' },
    { icon: '👷', label: 'Youth', query: 'Rules for workers under 18?' }
  ],
  de: [
    { icon: '🚜', label: 'Stapler', query: 'Staplerausbildung Anforderungen?' },
    { icon: '⏰', label: 'Arbeitszeit', query: 'Maximale Arbeitszeit?' },
    { icon: '🦺', label: 'PSA', query: 'Welche PSA im Lager?' },
    { icon: '🚨', label: 'Erste Hilfe', query: 'Ersthelfer Anforderungen?' },
    { icon: '📋', label: 'GBU', query: 'Gefährdungsbeurteilung Grundlagen?' },
    { icon: '👷', label: 'Jugend', query: 'Regeln für unter 18?' }
  ],
  nl: [
    { icon: '🚜', label: 'Heftruck', query: 'Heftrucktraining eisen?' },
    { icon: '⏰', label: 'Werktijd', query: 'Maximum werktijden?' },
    { icon: '🦺', label: 'PBM', query: 'Welke PBM in magazijn?' },
    { icon: '🚨', label: 'BHV', query: 'BHV eisen?' },
    { icon: '📋', label: 'RI&E', query: 'RI&E basisregels?' },
    { icon: '👷', label: 'Jeugd', query: 'Regels voor onder 18?' }
  ]
}

const UI_TEXT = {
  en: {
    title: 'Ask Erwin',
    subtitle: 'WHS Safety Expert',
    placeholder: 'Ask about safety laws...',
    send: 'Send',
    thinking: 'Thinking...',
    greeting: "Servus! I'm Erwin, your WHS guy. What safety question can I help with?",
    errorMessage: "Oops, something went wrong. Try again?",
    minimize: 'Minimize',
    powered: 'Created by Erwin in Vienna'
  },
  de: {
    title: 'Frag Erwin',
    subtitle: 'WHS Sicherheitsexperte',
    placeholder: 'Frag zu Sicherheitsgesetzen...',
    send: 'Senden',
    thinking: 'Denke nach...',
    greeting: "Servus! Ich bin der Erwin, dein WHS-Mensch. Was kann ich für dich tun?",
    errorMessage: "Hoppla, da ist was schiefgelaufen. Nochmal?",
    minimize: 'Minimieren',
    powered: 'Erschaffen von Erwin in Wien'
  },
  nl: {
    title: 'Vraag Erwin',
    subtitle: 'WHS Veiligheidsexpert',
    placeholder: 'Vraag over veiligheidswetten...',
    send: 'Verstuur',
    thinking: 'Denken...',
    greeting: "Servus! Ik ben Erwin, je WHS-man. Waarmee kan ik helpen?",
    errorMessage: "Oeps, er ging iets mis. Opnieuw?",
    minimize: 'Minimaliseren',
    powered: 'Gemaakt door Erwin in Wenen'
  }
}

// Maximum context length to keep costs down
const MAX_CONTEXT_LENGTH = 1500

// Response Modal Component for expanded view
function ResponseModal({ isOpen, onClose, message, onNavigateToLaw, language }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen || !message) return null

  const allLaws = getAllLawsFromAllCountries()
  const modalTitle = {
    en: 'Full Response',
    de: 'Vollständige Antwort',
    nl: 'Volledige Antwoord'
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
              <img src="/erwin.png" alt="Erwin" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{modalTitle[language] || modalTitle.en}</h2>
              <p className="text-white/70 text-xs">Erwin - WHS Safety Expert</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <FormattedAIResponse
            content={message.content}
            onLawClick={onNavigateToLaw}
            allLaws={allLaws}
            className="text-gray-800 dark:text-gray-200"
          />
        </div>
        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-whs-dark-700 bg-gray-50 dark:bg-whs-dark-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {language === 'de' ? 'Schließen' : language === 'nl' ? 'Sluiten' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function SafetyChatWidget({ onNavigateToLaw }) {
  const { framework, language } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState({ isLimited: false, remainingSeconds: 0 })
  const [expandedMessage, setExpandedMessage] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const lang = language || 'en'
  const ui = UI_TEXT[lang] || UI_TEXT.en
  const topics = QUICK_TOPICS[lang] || QUICK_TOPICS.en
  const systemPrompt = ERWIN_SYSTEM_PROMPT[lang] || ERWIN_SYSTEM_PROMPT.en

  // Check rate limit
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitInfo(getRateLimitStatus())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: ui.greeting,
        timestamp: new Date()
      }])
    }
  }, [isOpen, ui.greeting])

  // Search law database for context
  const searchLawContext = async (query) => {
    try {
      const results = await searchLaws(query, { limit: 3, country: null })
      let context = ''
      let contextLength = 0
      const foundLaws = []

      if (results?.results?.length > 0) {
        context += 'LAWS:\n'
        for (const law of results.results.slice(0, 2)) {
          foundLaws.push({
            id: law.id,
            abbreviation: law.abbreviation || law.title?.split(' ')[0],
            title: law.title,
            country: law.country || law.framework
          })

          let entry = `[${law.abbreviation}|${law.country}|ID:${law.id}] ${law.title}\n`
          if (law.summary) entry += `${law.summary.substring(0, 200)}\n`
          if (law.content?.full_text && contextLength < MAX_CONTEXT_LENGTH) {
            const remaining = MAX_CONTEXT_LENGTH - contextLength - entry.length
            if (remaining > 100) {
              entry += `${law.content.full_text.substring(0, Math.min(remaining, 500))}...\n`
            }
          }
          if (contextLength + entry.length > MAX_CONTEXT_LENGTH) break
          context += entry
          contextLength += entry.length
        }
      }
      return { context, foundLaws }
    } catch (error) {
      console.error('Search error:', error)
      return { context: '', foundLaws: [] }
    }
  }

  // Send message
  const handleSend = useCallback(async (messageText = inputValue) => {
    if (!messageText.trim() || isLoading || rateLimitInfo.isLimited) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const { context, foundLaws } = await searchLawContext(messageText)

      const fullPrompt = `${context ? `${context}\n` : ''}Q: ${messageText}\n\nBe concise. Include [LAW_ID:id] for any laws you reference.`
      const response = await generateAIResponse(fullPrompt, framework, language, systemPrompt)

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        laws: foundLaws
      }])
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ui.errorMessage,
        timestamp: new Date(),
        isError: true
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [inputValue, isLoading, rateLimitInfo.isLimited, framework, language, systemPrompt, ui.errorMessage])

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Closed state - just the button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
          <img src="/erwin.png" alt="Erwin" className="w-full h-full object-cover" />
        </div>
        <div className="text-left">
          <div className="font-semibold text-sm">{ui.title}</div>
          <div className="text-xs text-white/70">{ui.subtitle}</div>
        </div>
        <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
      </button>
    )
  }

  // Minimized state
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
          <img src="/erwin.png" alt="Erwin" className="w-full h-full object-cover" />
        </div>
        <span className="font-medium text-sm">{ui.title}</span>
        {messages.length > 1 && (
          <span className="w-5 h-5 bg-whs-orange-500 rounded-full text-xs flex items-center justify-center">
            {messages.length - 1}
          </span>
        )}
      </button>
    )
  }

  // Open chat widget
  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] flex flex-col bg-white dark:bg-whs-dark-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-whs-dark-700 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
            <img src="/erwin.png" alt="Erwin" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{ui.title}</div>
            <div className="text-xs text-white/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              {ui.subtitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title={ui.minimize}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 12H6" />
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-80 min-h-[200px]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.isError
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {message.role === 'assistant' && !message.isError ? (
                <div className="space-y-2">
                  <FormattedAIResponse
                    content={message.content}
                    onLawClick={onNavigateToLaw}
                    allLaws={getAllLawsFromAllCountries()}
                    className="text-sm leading-relaxed"
                  />
                  {/* Expand button for long responses */}
                  {message.content && message.content.length > 150 && (
                    <button
                      onClick={() => setExpandedMessage(message)}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-2 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      {lang === 'de' ? 'Erweitern' : lang === 'nl' ? 'Uitvouwen' : 'Expand'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-whs-dark-700 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                {ui.thinking}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Topics - only show at start */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {topics.map((topic, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(topic.query)}
              disabled={isLoading || rateLimitInfo.isLimited}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-whs-dark-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              <span>{topic.icon}</span>
              <span>{topic.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Rate limit warning */}
      {rateLimitInfo.isLimited && rateLimitInfo.remainingSeconds > 0 && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {rateLimitInfo.remainingSeconds}s
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-whs-dark-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={ui.placeholder}
            disabled={isLoading || rateLimitInfo.isLimited}
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading || rateLimitInfo.isLimited}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-whs-dark-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-center">
          {ui.powered}
        </p>
      </div>

      {/* Expanded Response Modal */}
      <ResponseModal
        isOpen={!!expandedMessage}
        onClose={() => setExpandedMessage(null)}
        message={expandedMessage}
        onNavigateToLaw={onNavigateToLaw}
        language={lang}
      />
    </div>
  )
}

export default SafetyChatWidget

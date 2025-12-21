import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { searchLaws, getLawById, getAllLaws } from '../../services/euLawsDatabase'
import { generateAIResponse, getRateLimitStatus } from '../../services/aiService'
import { LoadingSpinner, RateLimitIndicator } from '../ui'

// Erwin's personality - WHS Manager Austria, funny with dark humor but professional
const ERWIN_SYSTEM_PROMPT = {
  en: `You are Erwin, the WHS (Workplace Health & Safety) Manager for Austria. You have a distinctive personality:

PERSONALITY:
- Professional and knowledgeable about workplace safety laws
- Witty with a touch of dark humor (but never inappropriate for workplace)
- Direct and to the point - no fluff
- Austrian charm with occasional German expressions
- You take safety seriously, but you know how to keep things light
- You might crack a joke about "what could go wrong" but always follow up with the proper safety advice

COMMUNICATION STYLE:
- Start responses with a brief, witty observation when appropriate
- Get to the point quickly - managers are busy people
- Use concrete examples from warehouse/logistics when relevant
- Reference specific law paragraphs when answering legal questions
- End with a practical takeaway or action item

IMPORTANT RULES:
1. ONLY use information from the provided law database context - NEVER make up laws or cite external sources
2. If you don't have information about something, say "That's not in my law database, but I can tell you what I do know about..."
3. NEVER provide external links or URLs - all information must come from the internal database
4. When citing laws, use the exact abbreviations (ASchG, AZG, DGUV, etc.)
5. Focus on Austrian (AT), German (DE), and Dutch (NL) workplace safety laws
6. If asked about something outside workplace safety, politely redirect: "Look, I'm a safety guy, not a [topic] expert. Let's stick to keeping people in one piece, shall we?"

EXAMPLE RESPONSES:
- "Ah, forklift training - because nothing says 'bad day' like a pallet through the wall. According to ASchG §14..."
- "Night shifts? My favorite topic after 3am coffee. The AZG §12a requires..."
- "PPE requirements - because 'it'll be fine' are famous last words. Here's what the law says..."`,

  de: `Du bist Erwin, der WHS (Arbeitssicherheit) Manager für Österreich. Du hast eine besondere Persönlichkeit:

PERSÖNLICHKEIT:
- Professionell und kenntnisreich über Arbeitssicherheitsgesetze
- Witzig mit einem Hauch von schwarzem Humor (aber nie unangemessen für den Arbeitsplatz)
- Direkt und auf den Punkt - keine Floskeln
- Österreichischer Charme mit gelegentlichen Wiener Ausdrücken
- Du nimmst Sicherheit ernst, aber du weißt, wie man die Stimmung locker hält
- Du machst vielleicht einen Witz über "was könnte schon schiefgehen", aber gibst immer den richtigen Sicherheitshinweis danach

KOMMUNIKATIONSSTIL:
- Beginne Antworten mit einer kurzen, witzigen Beobachtung wenn passend
- Komm schnell zum Punkt - Manager sind beschäftigte Leute
- Verwende konkrete Beispiele aus Lager/Logistik wenn relevant
- Zitiere spezifische Gesetzesparagraphen bei rechtlichen Fragen
- Ende mit einem praktischen Fazit oder Handlungsauftrag

WICHTIGE REGELN:
1. Verwende NUR Informationen aus dem bereitgestellten Gesetzesdatenbank-Kontext - ERFINDE NIEMALS Gesetze
2. Wenn du keine Information hast, sag "Das hab ich nicht in meiner Datenbank, aber ich kann dir sagen was ich über... weiß"
3. NIEMALS externe Links oder URLs angeben - alle Informationen müssen aus der internen Datenbank kommen
4. Bei Gesetzeszitaten verwende die exakten Abkürzungen (ASchG, AZG, DGUV, etc.)
5. Fokus auf österreichische (AT), deutsche (DE) und niederländische (NL) Arbeitssicherheitsgesetze
6. Bei Fragen außerhalb der Arbeitssicherheit höflich umlenken: "Schau, ich bin Sicherheitsmensch, kein [Thema]-Experte. Bleiben wir dabei, Leute heil zu halten, ja?"`,

  nl: `Je bent Erwin, de WHS (Arbeidsveiligheid) Manager uit Oostenrijk. Je hebt een onderscheidende persoonlijkheid:

PERSOONLIJKHEID:
- Professioneel en deskundig over arbeidsveiligheidswetten
- Gevat met een vleugje donkere humor (maar nooit ongepast voor de werkvloer)
- Direct en to the point - geen poespas
- Oostenrijkse charme met af en toe Duitse uitdrukkingen
- Je neemt veiligheid serieus, maar je weet hoe je de sfeer luchtig houdt

COMMUNICATIESTIJL:
- Begin antwoorden met een korte, gevatte observatie wanneer gepast
- Kom snel ter zake - managers zijn drukke mensen
- Gebruik concrete voorbeelden uit magazijn/logistiek wanneer relevant
- Verwijs naar specifieke wetsartikelen bij juridische vragen
- Eindig met een praktische conclusie of actie-item

BELANGRIJKE REGELS:
1. Gebruik ALLEEN informatie uit de aangeleverde wettendatabase - VERZIN NOOIT wetten
2. Als je geen informatie hebt, zeg "Dat heb ik niet in mijn database, maar ik kan je vertellen wat ik weet over..."
3. NOOIT externe links of URLs geven - alle informatie moet uit de interne database komen
4. Bij wetsverwijzingen gebruik de exacte afkortingen (Arbowet, Arbobesluit, ASchG, etc.)
5. Focus op Oostenrijkse (AT), Duitse (DE) en Nederlandse (NL) arbeidsveiligheidswetten`
}

// Extended WHS-focused quick suggestion topics
const QUICK_TOPICS = {
  en: [
    // Manual Handling & Ergonomics
    { icon: '📦', label: 'Lifting Limits', query: 'What are the maximum weight limits for manual lifting?', category: 'ergonomics' },
    { icon: '🔄', label: 'Repetitive Motion', query: 'How do I prevent repetitive strain injuries in the warehouse?', category: 'ergonomics' },
    // PIT (Powered Industrial Trucks)
    { icon: '🚜', label: 'Forklift Training', query: 'What are the forklift operator training and certification requirements?', category: 'pit' },
    { icon: '🔋', label: 'Battery Charging', query: 'What safety measures are required for forklift battery charging areas?', category: 'pit' },
    // Warehouse Operations
    { icon: '📐', label: 'Racking Safety', query: 'What are the safety requirements for warehouse racking and shelving?', category: 'warehouse' },
    { icon: '🚛', label: 'Loading Docks', query: 'What safety rules apply to loading dock operations?', category: 'warehouse' },
    // Working Hours & Rest
    { icon: '⏰', label: 'Working Hours', query: 'What are the legal maximum working hours and required breaks?', category: 'hours' },
    { icon: '🌙', label: 'Night Shifts', query: 'What special requirements apply for night shift workers?', category: 'hours' },
    // PPE
    { icon: '🦺', label: 'PPE Requirements', query: 'What PPE is legally required in warehouse operations?', category: 'ppe' },
    { icon: '👟', label: 'Safety Footwear', query: 'When is safety footwear mandatory and what standards apply?', category: 'ppe' },
    // Emergency & First Aid
    { icon: '🚨', label: 'First Aid', query: 'How many first aiders do I need for my workforce size?', category: 'emergency' },
    { icon: '🔥', label: 'Fire Safety', query: 'What are the fire safety and evacuation requirements?', category: 'emergency' },
    // Documentation & Compliance
    { icon: '📋', label: 'Risk Assessment', query: 'What must be included in a workplace risk assessment?', category: 'compliance' },
    { icon: '📝', label: 'Documentation', query: 'What safety documentation must I keep and for how long?', category: 'compliance' },
    // Special Groups
    { icon: '👷', label: 'Young Workers', query: 'What special protections apply to workers under 18?', category: 'special' },
    { icon: '🤰', label: 'Pregnant Workers', query: 'What work restrictions apply to pregnant employees?', category: 'special' }
  ],
  de: [
    // Manuelle Handhabung & Ergonomie
    { icon: '📦', label: 'Hebe-Grenzen', query: 'Was sind die maximalen Gewichtsgrenzen beim manuellen Heben?', category: 'ergonomics' },
    { icon: '🔄', label: 'Wiederholungsbewegungen', query: 'Wie verhindere ich Überlastungsschäden im Lager?', category: 'ergonomics' },
    // Stapler
    { icon: '🚜', label: 'Staplerausbildung', query: 'Was sind die Anforderungen für die Staplerfahrer-Ausbildung?', category: 'pit' },
    { icon: '🔋', label: 'Ladestation', query: 'Welche Sicherheitsmaßnahmen gelten für Stapler-Ladebereiche?', category: 'pit' },
    // Lagerbetrieb
    { icon: '📐', label: 'Regalsicherheit', query: 'Welche Sicherheitsanforderungen gelten für Lagerregale?', category: 'warehouse' },
    { icon: '🚛', label: 'Laderampen', query: 'Welche Sicherheitsregeln gelten an Laderampen?', category: 'warehouse' },
    // Arbeitszeit
    { icon: '⏰', label: 'Arbeitszeit', query: 'Was sind die gesetzlichen Höchstarbeitszeiten und Pausenregelungen?', category: 'hours' },
    { icon: '🌙', label: 'Nachtarbeit', query: 'Welche besonderen Regeln gelten für Nachtschichtarbeiter?', category: 'hours' },
    // PSA
    { icon: '🦺', label: 'PSA-Pflicht', query: 'Welche PSA ist im Lagerbetrieb gesetzlich vorgeschrieben?', category: 'ppe' },
    { icon: '👟', label: 'Sicherheitsschuhe', query: 'Wann sind Sicherheitsschuhe Pflicht und welche Normen gelten?', category: 'ppe' },
    // Notfall & Erste Hilfe
    { icon: '🚨', label: 'Erste Hilfe', query: 'Wie viele Ersthelfer brauche ich für meine Belegschaft?', category: 'emergency' },
    { icon: '🔥', label: 'Brandschutz', query: 'Welche Brandschutz- und Evakuierungsanforderungen gelten?', category: 'emergency' },
    // Dokumentation
    { icon: '📋', label: 'Gefährdungsbeurteilung', query: 'Was muss eine Gefährdungsbeurteilung enthalten?', category: 'compliance' },
    { icon: '📝', label: 'Dokumentation', query: 'Welche Sicherheitsdokumentation muss ich wie lange aufbewahren?', category: 'compliance' },
    // Besondere Gruppen
    { icon: '👷', label: 'Jugendschutz', query: 'Welcher besondere Schutz gilt für Arbeitnehmer unter 18?', category: 'special' },
    { icon: '🤰', label: 'Mutterschutz', query: 'Welche Arbeitsbeschränkungen gelten für schwangere Mitarbeiterinnen?', category: 'special' }
  ],
  nl: [
    // Handmatig tillen & Ergonomie
    { icon: '📦', label: 'Tilgewicht', query: 'Wat zijn de maximale gewichten voor handmatig tillen?', category: 'ergonomics' },
    { icon: '🔄', label: 'RSI Preventie', query: 'Hoe voorkom ik RSI-klachten in het magazijn?', category: 'ergonomics' },
    // Heftrucks
    { icon: '🚜', label: 'Heftrucktraining', query: 'Wat zijn de eisen voor heftruckbestuurder-opleiding?', category: 'pit' },
    { icon: '🔋', label: 'Laadruimte', query: 'Welke veiligheidsmaatregelen gelden voor heftruck-laadruimtes?', category: 'pit' },
    // Magazijn
    { icon: '📐', label: 'Stellingveiligheid', query: 'Welke veiligheidseisen gelden voor magazijnstellingen?', category: 'warehouse' },
    { icon: '🚛', label: 'Laadperrons', query: 'Welke veiligheidsregels gelden bij laadperrons?', category: 'warehouse' },
    // Werktijden
    { icon: '⏰', label: 'Werktijden', query: 'Wat zijn de wettelijke maximum werktijden en pauze-eisen?', category: 'hours' },
    { icon: '🌙', label: 'Nachtdienst', query: 'Welke speciale regels gelden voor nachtdienstwerkers?', category: 'hours' },
    // PBM
    { icon: '🦺', label: 'PBM Vereisten', query: 'Welke PBM is wettelijk verplicht bij magazijnwerk?', category: 'ppe' },
    { icon: '👟', label: 'Veiligheidsschoenen', query: 'Wanneer zijn veiligheidsschoenen verplicht en welke normen gelden?', category: 'ppe' },
    // BHV & Eerste hulp
    { icon: '🚨', label: 'BHV', query: 'Hoeveel BHV-ers heb ik nodig voor mijn personeelsomvang?', category: 'emergency' },
    { icon: '🔥', label: 'Brandveiligheid', query: 'Welke brandveiligheids- en ontruimingseisen gelden?', category: 'emergency' },
    // Documentatie
    { icon: '📋', label: 'RI&E', query: 'Wat moet een RI&E bevatten?', category: 'compliance' },
    { icon: '📝', label: 'Documentatie', query: 'Welke veiligheidsdocumentatie moet ik hoe lang bewaren?', category: 'compliance' },
    // Speciale groepen
    { icon: '👷', label: 'Jonge werknemers', query: 'Welke speciale bescherming geldt voor werknemers onder 18?', category: 'special' },
    { icon: '🤰', label: 'Zwangerschap', query: 'Welke werkbeperkingen gelden voor zwangere werknemers?', category: 'special' }
  ]
}

// Topic category labels for grouping
const TOPIC_CATEGORIES = {
  en: {
    ergonomics: 'Manual Handling',
    pit: 'Forklift/PIT',
    warehouse: 'Warehouse',
    hours: 'Working Hours',
    ppe: 'PPE',
    emergency: 'Emergency',
    compliance: 'Compliance',
    special: 'Special Groups'
  },
  de: {
    ergonomics: 'Handhabung',
    pit: 'Stapler',
    warehouse: 'Lager',
    hours: 'Arbeitszeit',
    ppe: 'PSA',
    emergency: 'Notfall',
    compliance: 'Compliance',
    special: 'Besondere'
  },
  nl: {
    ergonomics: 'Tillen',
    pit: 'Heftruck',
    warehouse: 'Magazijn',
    hours: 'Werktijd',
    ppe: 'PBM',
    emergency: 'BHV',
    compliance: 'Compliance',
    special: 'Speciaal'
  }
}

// Maximum context length to keep costs down (characters)
const MAX_CONTEXT_LENGTH = 2000

// UI text translations
const UI_TEXT = {
  en: {
    title: 'Safety Assistant',
    subtitle: 'Ask Erwin about workplace safety',
    placeholder: 'Ask me anything about workplace safety...',
    send: 'Send',
    thinking: 'Erwin is thinking...',
    quickTopics: 'Quick Topics - Click to ask',
    moreTopics: 'More Topics',
    lessTopics: 'Less Topics',
    noExternalLinks: 'I only use our internal law database - no external sources.',
    greeting: "Servus! I'm Erwin, your WHS Manager. I know Austrian, German, and Dutch safety laws inside out. What safety question keeps you up at night? (Besides the actual night shift regulations, of course... AZG §12a, if you're curious.)",
    errorMessage: "Oops, something went wrong. Even safety systems have bad days. Try again?",
    disclaimer: 'Erwin uses only the internal law database. For binding legal advice, consult official sources.',
    clearChat: 'Clear',
    sources: 'Referenced Laws',
    rateLimitWait: 'Please wait',
    rateLimitSeconds: 'seconds before next question',
    costNote: 'AI responses use tokens - ask specific questions for best results'
  },
  de: {
    title: 'Sicherheits-Assistent',
    subtitle: 'Frag Erwin über Arbeitssicherheit',
    placeholder: 'Frag mich alles über Arbeitssicherheit...',
    send: 'Senden',
    thinking: 'Erwin denkt nach...',
    quickTopics: 'Schnellthemen - Klicken zum Fragen',
    moreTopics: 'Mehr Themen',
    lessTopics: 'Weniger',
    noExternalLinks: 'Nur interne Gesetzesdatenbank - keine externen Quellen.',
    greeting: "Servus! Ich bin der Erwin, dein WHS Manager. Österreichische, deutsche und niederländische Sicherheitsgesetze kenn ich wie meine Westentasche. Welche Sicherheitsfrage lässt dich nicht schlafen? (Abgesehen von den Nachtarbeitsvorschriften natürlich... AZG §12a, falls es dich interessiert.)",
    errorMessage: "Hoppla, da ist was schiefgelaufen. Selbst Sicherheitssysteme haben schlechte Tage. Nochmal versuchen?",
    disclaimer: 'Erwin verwendet nur die interne Gesetzesdatenbank. Für verbindliche Rechtsberatung offizielle Quellen konsultieren.',
    clearChat: 'Löschen',
    sources: 'Referenzierte Gesetze',
    rateLimitWait: 'Bitte warten',
    rateLimitSeconds: 'Sekunden bis zur nächsten Frage',
    costNote: 'KI-Antworten verbrauchen Tokens - stelle spezifische Fragen für beste Ergebnisse'
  },
  nl: {
    title: 'Veiligheidsassistent',
    subtitle: 'Vraag Erwin over arbeidsveiligheid',
    placeholder: 'Vraag me alles over arbeidsveiligheid...',
    send: 'Verstuur',
    thinking: 'Erwin denkt na...',
    quickTopics: 'Snelle Onderwerpen - Klik om te vragen',
    moreTopics: 'Meer Onderwerpen',
    lessTopics: 'Minder',
    noExternalLinks: 'Alleen interne wettendatabase - geen externe bronnen.',
    greeting: "Servus! Ik ben Erwin, je WHS Manager. Ik ken de Oostenrijkse, Duitse en Nederlandse veiligheidswetten als mijn broekzak. Welke veiligheidsvraag houdt je 's nachts wakker? (Behalve de nachtdienstregels natuurlijk... ATW artikel 5.8, mocht je nieuwsgierig zijn.)",
    errorMessage: "Oeps, er ging iets mis. Zelfs veiligheidssystemen hebben slechte dagen. Opnieuw proberen?",
    disclaimer: 'Erwin gebruikt alleen de interne wettendatabase. Voor bindend juridisch advies, raadpleeg officiële bronnen.',
    clearChat: 'Wissen',
    sources: 'Gerefereerde Wetten',
    rateLimitWait: 'Even wachten',
    rateLimitSeconds: 'seconden tot volgende vraag',
    costNote: 'AI-antwoorden verbruiken tokens - stel specifieke vragen voor beste resultaten'
  }
}

export function SafetyChatbot({ onBack, onNavigateToLaw }) {
  const { framework, language, t } = useApp()
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [referencedLaws, setReferencedLaws] = useState([])
  const [showAllTopics, setShowAllTopics] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState({ isLimited: false, remainingSeconds: 0 })
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const rateLimitIntervalRef = useRef(null)

  const lang = language || 'en'
  const ui = UI_TEXT[lang] || UI_TEXT.en
  const allTopics = QUICK_TOPICS[lang] || QUICK_TOPICS.en
  const categoryLabels = TOPIC_CATEGORIES[lang] || TOPIC_CATEGORIES.en
  const systemPrompt = ERWIN_SYSTEM_PROMPT[lang] || ERWIN_SYSTEM_PROMPT.en

  // Get visible topics (first 6 or all)
  const visibleTopics = showAllTopics ? allTopics : allTopics.slice(0, 6)

  // Check rate limit status periodically
  useEffect(() => {
    const checkRateLimit = () => {
      const status = getRateLimitStatus()
      setRateLimitInfo(status)
    }

    checkRateLimit()
    rateLimitIntervalRef.current = setInterval(checkRateLimit, 1000)

    return () => {
      if (rateLimitIntervalRef.current) {
        clearInterval(rateLimitIntervalRef.current)
      }
    }
  }, [])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Add greeting message on mount
  useEffect(() => {
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: ui.greeting,
      timestamp: new Date()
    }])
  }, [lang]) // Reset when language changes

  // Search the law database for relevant context (optimized for cost)
  const searchLawContext = async (query) => {
    try {
      // Search across all loaded frameworks
      const results = await searchLaws(query, {
        limit: 5,
        country: null // Search all countries
      })

      // Build context from search results - OPTIMIZED for token usage
      let context = ''
      let contextLength = 0
      const foundLaws = []

      if (results && results.results && results.results.length > 0) {
        context += 'LAWS FROM DATABASE:\n'

        // Only include top 2-3 most relevant results to save tokens
        for (const law of results.results.slice(0, 3)) {
          foundLaws.push({
            id: law.id,
            abbreviation: law.abbreviation || law.title?.split(' ')[0],
            title: law.title,
            country: law.country || law.framework
          })

          // Build compact context entry
          let entry = `\n[${law.abbreviation || 'Law'}|${law.country || law.framework}] ${law.title}\n`
          if (law.summary) {
            entry += `Summary: ${law.summary.substring(0, 300)}\n`
          }

          // Include content excerpt only if we have room (cost optimization)
          if (law.content?.full_text && contextLength < MAX_CONTEXT_LENGTH) {
            const remainingSpace = MAX_CONTEXT_LENGTH - contextLength - entry.length
            if (remainingSpace > 200) {
              const excerptLength = Math.min(remainingSpace - 50, 800)
              entry += `Content: ${law.content.full_text.substring(0, excerptLength)}...\n`
            }
          }

          // Check if adding this entry exceeds our limit
          if (contextLength + entry.length > MAX_CONTEXT_LENGTH + 500) {
            break // Stop adding more laws to keep costs down
          }

          context += entry
          contextLength += entry.length
        }
      }

      return { context, foundLaws }
    } catch (error) {
      console.error('Error searching law database:', error)
      return { context: '', foundLaws: [] }
    }
  }

  // Send message
  const handleSend = useCallback(async (messageText = inputValue) => {
    if (!messageText.trim() || isLoading) return

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
      // Search law database for relevant context
      const { context: lawContext, foundLaws } = await searchLawContext(messageText)

      // Update referenced laws
      if (foundLaws.length > 0) {
        setReferencedLaws(prev => {
          const existingIds = new Set(prev.map(l => l.id))
          const newLaws = foundLaws.filter(l => !existingIds.has(l.id))
          return [...prev, ...newLaws].slice(-10) // Keep last 10
        })
      }

      // Build the complete prompt with context - OPTIMIZED for token efficiency
      const fullPrompt = `${lawContext ? `${lawContext}\n` : ''}Q: ${messageText}

Rules: Use ONLY above context. No external links. Be concise. Cite law abbreviations.`

      // Call AI service with Erwin's personality
      const response = await generateAIResponse(fullPrompt, framework, language, systemPrompt)

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        laws: foundLaws
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error getting response:', error)

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ui.errorMessage,
        timestamp: new Date(),
        isError: true
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [inputValue, isLoading, framework, language, systemPrompt, ui.errorMessage])

  // Handle quick topic click
  const handleQuickTopic = (query) => {
    handleSend(query)
  }

  // Clear chat
  const handleClearChat = () => {
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: ui.greeting,
      timestamp: new Date()
    }])
    setReferencedLaws([])
  }

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="animate-fade-in h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-whs-orange-500 dark:hover:text-whs-orange-400 transition-colors"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            {t.common.back}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleClearChat}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            {ui.clearChat}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-whs-orange-500/10 dark:bg-whs-orange-500/20 rounded-full border border-whs-orange-500/20">
            <span className="text-xl">🦺</span>
            <span className="text-sm font-medium text-whs-orange-600 dark:text-whs-orange-400">
              Erwin - WHS Manager
            </span>
          </div>
        </div>
      </div>

      {/* Title Section */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-3">
          <span className="text-3xl">👷</span>
          {ui.title}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{ui.subtitle}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center justify-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {ui.noExternalLinks}
        </p>
      </div>

      {/* Main Chat Container */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-whs-dark-800 rounded-2xl border border-gray-200 dark:border-whs-dark-700 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-whs-orange-500 text-white'
                      : message.isError
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                      : 'bg-gray-100 dark:bg-whs-dark-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {message.role === 'assistant' && !message.isError && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-whs-dark-600">
                      <span className="text-lg">👷</span>
                      <span className="text-sm font-medium text-whs-orange-600 dark:text-whs-orange-400">Erwin</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                  {message.laws && message.laws.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-whs-dark-600">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{ui.sources}:</p>
                      <div className="flex flex-wrap gap-1">
                        {message.laws.map((law, idx) => (
                          <button
                            key={idx}
                            onClick={() => onNavigateToLaw?.(law.id, law.country)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-300 rounded text-xs hover:bg-whs-orange-200 dark:hover:bg-whs-orange-900/50 transition-colors"
                          >
                            <span className="opacity-70">
                              {law.country === 'AT' ? '🇦🇹' : law.country === 'DE' ? '🇩🇪' : '🇳🇱'}
                            </span>
                            {law.abbreviation}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-whs-dark-700 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{ui.thinking}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Topics (shown when few messages) */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2 border-t border-gray-100 dark:border-whs-dark-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{ui.quickTopics}</p>
                {allTopics.length > 6 && (
                  <button
                    onClick={() => setShowAllTopics(!showAllTopics)}
                    className="text-xs text-whs-orange-500 hover:text-whs-orange-600 font-medium"
                  >
                    {showAllTopics ? ui.lessTopics : ui.moreTopics} ({allTopics.length})
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {visibleTopics.map((topic, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickTopic(topic.query)}
                    disabled={isLoading || rateLimitInfo.isLimited}
                    title={topic.query}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-whs-dark-700 hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{topic.icon}</span>
                    <span>{topic.label}</span>
                  </button>
                ))}
              </div>
              {/* Cost/Rate limit hint */}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {ui.costNote}
              </p>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 dark:border-whs-dark-700">
            {/* Rate limit warning */}
            {rateLimitInfo.isLimited && rateLimitInfo.remainingSeconds > 0 && (
              <div className="mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{ui.rateLimitWait}: <strong>{rateLimitInfo.remainingSeconds}</strong> {ui.rateLimitSeconds}</span>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={rateLimitInfo.isLimited ? `${ui.rateLimitWait}...` : ui.placeholder}
                disabled={isLoading || rateLimitInfo.isLimited}
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-whs-dark-700 border border-gray-200 dark:border-whs-dark-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-whs-orange-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isLoading || rateLimitInfo.isLimited}
                className="px-6 py-3 bg-whs-orange-500 hover:bg-whs-orange-600 disabled:bg-gray-300 dark:disabled:bg-whs-dark-600 text-white rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
              >
                {ui.send}
              </button>
            </div>
          </div>
        </div>

        {/* Referenced Laws Sidebar */}
        {referencedLaws.length > 0 && (
          <div className="w-64 bg-white dark:bg-whs-dark-800 rounded-2xl border border-gray-200 dark:border-whs-dark-700 p-4 overflow-y-auto hidden lg:block">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-whs-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {ui.sources}
            </h3>
            <div className="space-y-2">
              {referencedLaws.map((law, idx) => (
                <button
                  key={law.id || idx}
                  onClick={() => onNavigateToLaw?.(law.id, law.country)}
                  className="w-full text-left p-2 bg-gray-50 dark:bg-whs-dark-700 hover:bg-whs-orange-50 dark:hover:bg-whs-orange-900/20 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {law.country === 'AT' ? '🇦🇹' : law.country === 'DE' ? '🇩🇪' : '🇳🇱'}
                    </span>
                    <span className="text-sm font-medium text-whs-orange-600 dark:text-whs-orange-400 group-hover:underline">
                      {law.abbreviation}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {law.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {ui.disclaimer}
        </p>
      </div>
    </div>
  )
}

export default SafetyChatbot

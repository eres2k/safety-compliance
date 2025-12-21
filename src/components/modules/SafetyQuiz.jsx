import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { Card, CardContent } from '../ui'
import { getAllLawsSync, WHS_TOPIC_LABELS } from '../../services/euLawsDatabase'

/**
 * Safety Quiz Game - Interactive quiz for safety coordinators
 * Tests knowledge of workplace safety laws and regulations
 * Integrated with the laws database and PDFs
 */

// Quiz categories based on WHS topics
const QUIZ_CATEGORIES = [
  { id: 'general', label: 'Allgemein', labelEn: 'General', icon: '📚', color: 'blue' },
  { id: 'ppe', label: 'PSA / PPE', labelEn: 'PPE', icon: '🦺', color: 'yellow' },
  { id: 'first_aid', label: 'Erste Hilfe', labelEn: 'First Aid', icon: '🏥', color: 'red' },
  { id: 'risk_assessment', label: 'Gefährdungsbeurteilung', labelEn: 'Risk Assessment', icon: '⚠️', color: 'orange' },
  { id: 'training', label: 'Unterweisung', labelEn: 'Training', icon: '🎓', color: 'purple' },
  { id: 'workplace_design', label: 'Arbeitsplatzgestaltung', labelEn: 'Workplace Design', icon: '🏭', color: 'gray' },
  { id: 'hazardous_substances', label: 'Gefahrstoffe', labelEn: 'Hazardous Substances', icon: '☣️', color: 'amber' },
  { id: 'ergonomics', label: 'Ergonomie', labelEn: 'Ergonomics', icon: '🧘', color: 'teal' },
]

// Quiz questions database - generated from law content
const QUIZ_QUESTIONS = {
  AT: [
    {
      id: 'at-1',
      category: 'general',
      type: 'multiple_choice',
      question: 'Welches Gesetz bildet die Grundlage für den Arbeitnehmerschutz in Österreich?',
      questionEn: 'Which law forms the basis for employee protection in Austria?',
      options: ['ASchG', 'BauV', 'AAV', 'GKV'],
      correctAnswer: 0,
      explanation: 'Das ArbeitnehmerInnenschutzgesetz (ASchG) ist das zentrale Gesetz für den Arbeitsschutz in Österreich.',
      explanationEn: 'The Employee Protection Act (ASchG) is the central law for occupational safety in Austria.',
      lawRef: { abbreviation: 'ASchG', section: '§ 1' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'at-2',
      category: 'first_aid',
      type: 'multiple_choice',
      question: 'Ab wie vielen Arbeitnehmern muss ein Ersthelfer bestellt werden gemäß ASchG?',
      questionEn: 'From how many employees must a first aider be appointed according to ASchG?',
      options: ['Ab 5 Arbeitnehmern', 'Ab 10 Arbeitnehmern', 'Ab 15 Arbeitnehmern', 'Ab 20 Arbeitnehmern'],
      correctAnswer: 0,
      explanation: 'Nach § 26 ASchG ist ab 5 regelmäßig beschäftigten Arbeitnehmern mindestens ein Ersthelfer zu bestellen.',
      explanationEn: 'According to § 26 ASchG, at least one first aider must be appointed for 5 or more regularly employed workers.',
      lawRef: { abbreviation: 'ASchG', section: '§ 26' },
      difficulty: 'medium',
      points: 15
    },
    {
      id: 'at-3',
      category: 'training',
      type: 'true_false',
      question: 'Unterweisungen müssen gemäß ASchG mindestens einmal jährlich wiederholt werden.',
      questionEn: 'Instructions must be repeated at least once a year according to ASchG.',
      correctAnswer: true,
      explanation: 'Gemäß § 14 Abs. 2 ASchG sind Unterweisungen in regelmäßigen Abständen, mindestens jedoch einmal jährlich zu wiederholen.',
      explanationEn: 'According to § 14 para. 2 ASchG, instructions must be repeated at regular intervals, at least once a year.',
      lawRef: { abbreviation: 'ASchG', section: '§ 14' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'at-4',
      category: 'risk_assessment',
      type: 'multiple_choice',
      question: 'Wer ist für die Durchführung der Gefährdungsbeurteilung verantwortlich?',
      questionEn: 'Who is responsible for carrying out the risk assessment?',
      options: ['Der Arbeitgeber', 'Die Sicherheitsfachkraft', 'Der Betriebsrat', 'Das Arbeitsinspektorat'],
      correctAnswer: 0,
      explanation: 'Nach § 4 ASchG ist der Arbeitgeber für die Ermittlung und Beurteilung der Gefahren verantwortlich.',
      explanationEn: 'According to § 4 ASchG, the employer is responsible for identifying and assessing hazards.',
      lawRef: { abbreviation: 'ASchG', section: '§ 4' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'at-5',
      category: 'ppe',
      type: 'multiple_choice',
      question: 'Wann muss Persönliche Schutzausrüstung (PSA) vom Arbeitgeber zur Verfügung gestellt werden?',
      questionEn: 'When must Personal Protective Equipment (PPE) be provided by the employer?',
      options: [
        'Wenn technische und organisatorische Maßnahmen nicht ausreichen',
        'Immer und überall',
        'Nur auf Wunsch der Arbeitnehmer',
        'Nur bei gefährlichen Arbeiten'
      ],
      correctAnswer: 0,
      explanation: 'PSA ist nach dem TOP-Prinzip die letzte Maßnahme: Technische vor Organisatorischen vor Persönlichen Schutzmaßnahmen.',
      explanationEn: 'PPE follows the TOP principle: Technical before Organizational before Personal protective measures.',
      lawRef: { abbreviation: 'ASchG', section: '§ 69-70' },
      difficulty: 'medium',
      points: 15
    },
    {
      id: 'at-6',
      category: 'workplace_design',
      type: 'fill_blank',
      question: 'Die Mindesttemperatur in Arbeitsräumen mit überwiegend sitzender Tätigkeit beträgt ___ °C.',
      questionEn: 'The minimum temperature in work rooms with predominantly sedentary work is ___ °C.',
      correctAnswer: '19',
      acceptedAnswers: ['19', '19°', '19 grad', '19°C'],
      explanation: 'Nach der AAV muss die Raumtemperatur bei vorwiegend sitzender Tätigkeit mindestens 19°C betragen.',
      explanationEn: 'According to AAV, the room temperature must be at least 19°C for predominantly sedentary work.',
      lawRef: { abbreviation: 'AAV', section: '§ 28' },
      difficulty: 'hard',
      points: 20
    },
  ],
  DE: [
    {
      id: 'de-1',
      category: 'general',
      type: 'multiple_choice',
      question: 'Welches Gesetz regelt den Arbeitsschutz in Deutschland grundlegend?',
      questionEn: 'Which law fundamentally regulates occupational safety in Germany?',
      options: ['Arbeitsschutzgesetz (ArbSchG)', 'Betriebssicherheitsverordnung', 'Arbeitsstättenverordnung', 'Gefahrstoffverordnung'],
      correctAnswer: 0,
      explanation: 'Das Arbeitsschutzgesetz (ArbSchG) ist das zentrale Gesetz für den Arbeitsschutz in Deutschland.',
      explanationEn: 'The Occupational Safety and Health Act (ArbSchG) is the central law for occupational safety in Germany.',
      lawRef: { abbreviation: 'ArbSchG', section: '§ 1' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'de-2',
      category: 'risk_assessment',
      type: 'multiple_choice',
      question: 'Wie oft muss die Gefährdungsbeurteilung aktualisiert werden?',
      questionEn: 'How often must the risk assessment be updated?',
      options: [
        'Bei wesentlichen Änderungen der Arbeitsbedingungen',
        'Einmal jährlich',
        'Alle 5 Jahre',
        'Nur bei Unfällen'
      ],
      correctAnswer: 0,
      explanation: 'Nach § 3 ArbSchG muss die Gefährdungsbeurteilung bei wesentlichen Änderungen aktualisiert werden.',
      explanationEn: 'According to § 3 ArbSchG, the risk assessment must be updated when there are significant changes.',
      lawRef: { abbreviation: 'ArbSchG', section: '§ 3' },
      difficulty: 'medium',
      points: 15
    },
    {
      id: 'de-3',
      category: 'training',
      type: 'true_false',
      question: 'Die Unterweisung muss während der Arbeitszeit erfolgen.',
      questionEn: 'Instruction must take place during working hours.',
      correctAnswer: true,
      explanation: 'Gemäß § 12 Abs. 1 ArbSchG hat die Unterweisung während der Arbeitszeit zu erfolgen.',
      explanationEn: 'According to § 12 para. 1 ArbSchG, instruction must take place during working hours.',
      lawRef: { abbreviation: 'ArbSchG', section: '§ 12' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'de-4',
      category: 'first_aid',
      type: 'multiple_choice',
      question: 'Wie viele Ersthelfer sind bei 2-20 anwesenden Versicherten erforderlich (DGUV Vorschrift 1)?',
      questionEn: 'How many first aiders are required for 2-20 insured persons present (DGUV Regulation 1)?',
      options: ['1 Ersthelfer', '2 Ersthelfer', '3 Ersthelfer', '5% der Belegschaft'],
      correctAnswer: 0,
      explanation: 'Nach DGUV Vorschrift 1 ist bei 2 bis 20 anwesenden Versicherten ein Ersthelfer erforderlich.',
      explanationEn: 'According to DGUV Regulation 1, one first aider is required for 2 to 20 insured persons present.',
      lawRef: { abbreviation: 'DGUV Vorschrift 1', section: '§ 26' },
      difficulty: 'medium',
      points: 15
    },
    {
      id: 'de-5',
      category: 'hazardous_substances',
      type: 'multiple_choice',
      question: 'Welche Verordnung regelt den Umgang mit Gefahrstoffen am Arbeitsplatz?',
      questionEn: 'Which regulation governs the handling of hazardous substances in the workplace?',
      options: ['Gefahrstoffverordnung (GefStoffV)', 'Chemikaliengesetz', 'REACH-Verordnung', 'CLP-Verordnung'],
      correctAnswer: 0,
      explanation: 'Die Gefahrstoffverordnung (GefStoffV) regelt den Umgang mit Gefahrstoffen am Arbeitsplatz in Deutschland.',
      explanationEn: 'The Hazardous Substances Ordinance (GefStoffV) regulates the handling of hazardous substances in the workplace in Germany.',
      lawRef: { abbreviation: 'GefStoffV', section: '§ 1' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'de-6',
      category: 'workplace_design',
      type: 'fill_blank',
      question: 'Die Mindestgrundfläche je Arbeitsplatz beträgt nach ASR A1.2 mindestens ___ m².',
      questionEn: 'The minimum floor space per workplace according to ASR A1.2 is at least ___ m².',
      correctAnswer: '8',
      acceptedAnswers: ['8', '8 m2', '8m²', 'acht'],
      explanation: 'Nach ASR A1.2 beträgt die Mindestgrundfläche 8 m² für den ersten Arbeitsplatz.',
      explanationEn: 'According to ASR A1.2, the minimum floor space is 8 m² for the first workplace.',
      lawRef: { abbreviation: 'ASR A1.2', section: 'Abschnitt 5' },
      difficulty: 'hard',
      points: 20
    },
    {
      id: 'de-7',
      category: 'ergonomics',
      type: 'true_false',
      question: 'Bei Bildschirmarbeit muss der Arbeitgeber eine Untersuchung der Augen anbieten.',
      questionEn: 'For screen work, the employer must offer an eye examination.',
      correctAnswer: true,
      explanation: 'Nach der Arbeitsstättenverordnung Anhang 6 müssen Arbeitgeber bei Bildschirmarbeit Vorsorgeuntersuchungen anbieten.',
      explanationEn: 'According to the Workplace Ordinance Annex 6, employers must offer preventive examinations for screen work.',
      lawRef: { abbreviation: 'ArbStättV', section: 'Anhang 6' },
      difficulty: 'medium',
      points: 15
    },
  ],
  NL: [
    {
      id: 'nl-1',
      category: 'general',
      type: 'multiple_choice',
      question: 'Welke wet vormt de basis voor arbeidsomstandigheden in Nederland?',
      questionEn: 'Which law forms the basis for working conditions in the Netherlands?',
      options: ['Arbeidsomstandighedenwet (Arbowet)', 'Arbeidstijdenwet', 'Arbobesluit', 'Wet BIG'],
      correctAnswer: 0,
      explanation: 'De Arbeidsomstandighedenwet (Arbowet) is de belangrijkste wet voor arbeidsomstandigheden in Nederland.',
      explanationEn: 'The Working Conditions Act (Arbowet) is the main law for working conditions in the Netherlands.',
      lawRef: { abbreviation: 'Arbowet', section: 'Art. 1' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'nl-2',
      category: 'risk_assessment',
      type: 'multiple_choice',
      question: 'Wat is de Nederlandse term voor Gefährdungsbeurteilung?',
      questionEn: 'What is the Dutch term for risk assessment?',
      options: ['RI&E (Risico-Inventarisatie en -Evaluatie)', 'Veiligheidsplan', 'Arbobeleid', 'Preventiemedewerker'],
      correctAnswer: 0,
      explanation: 'RI&E staat voor Risico-Inventarisatie en -Evaluatie en is verplicht voor alle werkgevers.',
      explanationEn: 'RI&E stands for Risk Inventory and Evaluation and is mandatory for all employers.',
      lawRef: { abbreviation: 'Arbowet', section: 'Art. 5' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'nl-3',
      category: 'first_aid',
      type: 'multiple_choice',
      question: 'Wie is verantwoordelijk voor bedrijfshulpverlening (BHV)?',
      questionEn: 'Who is responsible for company emergency response (BHV)?',
      options: ['De werkgever', 'De preventiemedewerker', 'De ondernemingsraad', 'De Arbeidsinspectie'],
      correctAnswer: 0,
      explanation: 'Volgens Arbowet Art. 15 is de werkgever verantwoordelijk voor het organiseren van BHV.',
      explanationEn: 'According to Arbowet Art. 15, the employer is responsible for organizing company emergency response.',
      lawRef: { abbreviation: 'Arbowet', section: 'Art. 15' },
      difficulty: 'easy',
      points: 10
    },
    {
      id: 'nl-4',
      category: 'training',
      type: 'true_false',
      question: 'Werknemers moeten voorlichting krijgen over de gevaren op het werk.',
      questionEn: 'Employees must receive information about hazards at work.',
      correctAnswer: true,
      explanation: 'Volgens Arbowet Art. 8 moet de werkgever werknemers voorlichting geven over gevaren en maatregelen.',
      explanationEn: 'According to Arbowet Art. 8, the employer must inform employees about hazards and measures.',
      lawRef: { abbreviation: 'Arbowet', section: 'Art. 8' },
      difficulty: 'easy',
      points: 10
    },
  ]
}

// Difficulty colors
const DIFFICULTY_CONFIG = {
  easy: { label: 'Leicht', labelEn: 'Easy', color: 'green', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-400' },
  medium: { label: 'Mittel', labelEn: 'Medium', color: 'yellow', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-700 dark:text-yellow-400' },
  hard: { label: 'Schwer', labelEn: 'Hard', color: 'red', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400' },
}

export function SafetyQuiz({ onBack, onSelectLaw, embedded = false }) {
  const { framework, language, addAuditEntry } = useApp()
  const lang = language || 'de'
  const isEnglish = lang === 'en'

  // Localized labels
  const labels = useMemo(() => ({
    title: isEnglish ? 'Safety Knowledge Quiz' : 'Wissensquiz Arbeitssicherheit',
    subtitle: isEnglish ? 'Test your knowledge of workplace safety regulations' : 'Testen Sie Ihr Wissen zu Arbeitsschutzvorschriften',
    startQuiz: isEnglish ? 'Start Quiz' : 'Quiz starten',
    continueQuiz: isEnglish ? 'Continue' : 'Weiter',
    nextQuestion: isEnglish ? 'Next Question' : 'Nächste Frage',
    finishQuiz: isEnglish ? 'Finish Quiz' : 'Quiz beenden',
    viewResults: isEnglish ? 'View Results' : 'Ergebnisse anzeigen',
    playAgain: isEnglish ? 'Play Again' : 'Nochmal spielen',
    backToMenu: isEnglish ? 'Back to Menu' : 'Zurück zum Menü',
    question: isEnglish ? 'Question' : 'Frage',
    of: isEnglish ? 'of' : 'von',
    correct: isEnglish ? 'Correct!' : 'Richtig!',
    incorrect: isEnglish ? 'Incorrect' : 'Falsch',
    explanation: isEnglish ? 'Explanation' : 'Erklärung',
    lawReference: isEnglish ? 'Law Reference' : 'Gesetzesreferenz',
    yourAnswer: isEnglish ? 'Your Answer' : 'Ihre Antwort',
    correctAnswer: isEnglish ? 'Correct Answer' : 'Richtige Antwort',
    score: isEnglish ? 'Score' : 'Punkte',
    totalScore: isEnglish ? 'Total Score' : 'Gesamtpunktzahl',
    percentage: isEnglish ? 'Percentage' : 'Prozent',
    questionsAnswered: isEnglish ? 'Questions Answered' : 'Beantwortete Fragen',
    correctAnswers: isEnglish ? 'Correct Answers' : 'Richtige Antworten',
    timeSpent: isEnglish ? 'Time Spent' : 'Zeit',
    category: isEnglish ? 'Category' : 'Kategorie',
    allCategories: isEnglish ? 'All Categories' : 'Alle Kategorien',
    difficulty: isEnglish ? 'Difficulty' : 'Schwierigkeit',
    allDifficulties: isEnglish ? 'All Difficulties' : 'Alle Schwierigkeiten',
    numberOfQuestions: isEnglish ? 'Number of Questions' : 'Anzahl Fragen',
    selectAnswer: isEnglish ? 'Select an answer' : 'Wählen Sie eine Antwort',
    typeAnswer: isEnglish ? 'Type your answer' : 'Geben Sie Ihre Antwort ein',
    submit: isEnglish ? 'Submit' : 'Absenden',
    true: isEnglish ? 'True' : 'Wahr',
    false: isEnglish ? 'False' : 'Falsch',
    quizResults: isEnglish ? 'Quiz Results' : 'Quiz-Ergebnisse',
    excellent: isEnglish ? 'Excellent!' : 'Ausgezeichnet!',
    good: isEnglish ? 'Good job!' : 'Gut gemacht!',
    needsImprovement: isEnglish ? 'Keep learning!' : 'Weiter lernen!',
    viewLaw: isEnglish ? 'View Law' : 'Gesetz anzeigen',
    points: isEnglish ? 'points' : 'Punkte',
    highScore: isEnglish ? 'High Score' : 'Highscore',
    recentScores: isEnglish ? 'Recent Scores' : 'Letzte Ergebnisse',
  }), [isEnglish])

  // Quiz state
  const [gameState, setGameState] = useState('menu') // menu, playing, result, review
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [numberOfQuestions, setNumberOfQuestions] = useState(5)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentAnswer, setCurrentAnswer] = useState(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [endTime, setEndTime] = useState(null)
  const [scores, setScores] = useState(() => {
    const saved = localStorage.getItem('whs_quiz_scores')
    return saved ? JSON.parse(saved) : []
  })

  // Get questions for current framework
  const availableQuestions = useMemo(() => {
    let qs = QUIZ_QUESTIONS[framework] || QUIZ_QUESTIONS.DE

    if (selectedCategory !== 'all') {
      qs = qs.filter(q => q.category === selectedCategory)
    }
    if (selectedDifficulty !== 'all') {
      qs = qs.filter(q => q.difficulty === selectedDifficulty)
    }

    return qs
  }, [framework, selectedCategory, selectedDifficulty])

  // Start quiz
  const startQuiz = useCallback(() => {
    // Shuffle and select questions
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(numberOfQuestions, shuffled.length))

    setQuestions(selected)
    setCurrentQuestionIndex(0)
    setAnswers({})
    setCurrentAnswer(null)
    setShowFeedback(false)
    setStartTime(new Date())
    setEndTime(null)
    setGameState('playing')

    addAuditEntry({
      action: 'quiz_started',
      lawId: 'quiz',
      lawTitle: 'Safety Quiz',
      notes: `Started quiz with ${selected.length} questions in ${framework}`
    })
  }, [availableQuestions, numberOfQuestions, framework, addAuditEntry])

  // Submit answer
  const submitAnswer = useCallback(() => {
    if (currentAnswer === null) return

    const currentQuestion = questions[currentQuestionIndex]
    let isCorrect = false

    if (currentQuestion.type === 'multiple_choice') {
      isCorrect = currentAnswer === currentQuestion.correctAnswer
    } else if (currentQuestion.type === 'true_false') {
      isCorrect = currentAnswer === currentQuestion.correctAnswer
    } else if (currentQuestion.type === 'fill_blank') {
      const userAnswer = currentAnswer.toString().toLowerCase().trim()
      isCorrect = currentQuestion.acceptedAnswers.some(a =>
        a.toLowerCase().trim() === userAnswer
      )
    }

    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        answer: currentAnswer,
        isCorrect,
        points: isCorrect ? currentQuestion.points : 0
      }
    }))
    setShowFeedback(true)
  }, [currentAnswer, currentQuestionIndex, questions])

  // Move to next question
  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setCurrentAnswer(null)
      setShowFeedback(false)
    } else {
      // Quiz finished
      const finishTime = new Date()
      setEndTime(finishTime)

      // Calculate final score
      const totalPoints = Object.values(answers).reduce((sum, a) => sum + a.points, 0)
      const maxPoints = questions.reduce((sum, q) => sum + q.points, 0)
      const correctCount = Object.values(answers).filter(a => a.isCorrect).length

      // Save score
      const newScore = {
        date: finishTime.toISOString(),
        framework,
        category: selectedCategory,
        totalPoints,
        maxPoints,
        percentage: Math.round((totalPoints / maxPoints) * 100),
        questionsAnswered: questions.length,
        correctAnswers: correctCount,
        timeSeconds: Math.round((finishTime - startTime) / 1000)
      }

      const updatedScores = [newScore, ...scores].slice(0, 10)
      setScores(updatedScores)
      localStorage.setItem('whs_quiz_scores', JSON.stringify(updatedScores))

      addAuditEntry({
        action: 'quiz_completed',
        lawId: 'quiz',
        lawTitle: 'Safety Quiz',
        notes: `Completed quiz: ${correctCount}/${questions.length} correct, ${totalPoints}/${maxPoints} points`
      })

      setGameState('result')
    }
  }, [currentQuestionIndex, questions, answers, framework, selectedCategory, startTime, scores, addAuditEntry])

  // Calculate current score
  const currentScore = useMemo(() => {
    const totalPoints = Object.values(answers).reduce((sum, a) => sum + a.points, 0)
    const maxPoints = questions.slice(0, currentQuestionIndex + 1).reduce((sum, q) => sum + q.points, 0)
    const correctCount = Object.values(answers).filter(a => a.isCorrect).length
    return { totalPoints, maxPoints, correctCount }
  }, [answers, questions, currentQuestionIndex])

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get result message
  const getResultMessage = (percentage) => {
    if (percentage >= 80) return { message: labels.excellent, emoji: '🏆' }
    if (percentage >= 60) return { message: labels.good, emoji: '👍' }
    return { message: labels.needsImprovement, emoji: '📚' }
  }

  // Handle law reference click
  const handleLawClick = (lawRef) => {
    if (onSelectLaw && lawRef) {
      onSelectLaw({ abbreviation: lawRef.abbreviation, section: lawRef.section })
    }
  }

  // Current question
  const currentQuestion = questions[currentQuestionIndex]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!embedded && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-whs-dark-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className={`${embedded ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white flex items-center gap-2`}>
              <span>🎯</span> {labels.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{labels.subtitle}</p>
          </div>
        </div>

        {gameState === 'playing' && (
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {labels.score}: <span className="text-whs-orange-500">{currentScore.totalPoints}</span>
            </div>
          </div>
        )}
      </div>

      {/* Menu State */}
      {gameState === 'menu' && (
        <div className="space-y-6">
          {/* Quiz Configuration */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quiz konfigurieren
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {labels.category}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
                  >
                    <option value="all">{labels.allCategories}</option>
                    {QUIZ_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {isEnglish ? cat.labelEn : cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Difficulty Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {labels.difficulty}
                  </label>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
                  >
                    <option value="all">{labels.allDifficulties}</option>
                    {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {isEnglish ? config.labelEn : config.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Number of Questions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {labels.numberOfQuestions}
                  </label>
                  <select
                    value={numberOfQuestions}
                    onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-600 rounded-lg text-sm"
                  >
                    {[3, 5, 10, 15, 20].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 dark:bg-whs-dark-900 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {availableQuestions.length} {isEnglish ? 'questions available' : 'Fragen verfügbar'}
                </p>
              </div>

              <button
                onClick={startQuiz}
                disabled={availableQuestions.length === 0}
                className="mt-6 w-full py-3 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 text-white font-semibold rounded-xl hover:from-whs-orange-600 hover:to-whs-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>🎮</span> {labels.startQuiz}
              </button>
            </CardContent>
          </Card>

          {/* Recent Scores */}
          {scores.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>🏆</span> {labels.recentScores}
                </h3>
                <div className="space-y-2">
                  {scores.slice(0, 5).map((score, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-whs-dark-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {score.percentage >= 80 ? '🥇' : score.percentage >= 60 ? '🥈' : '🥉'}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {score.percentage}% - {score.totalPoints}/{score.maxPoints} {labels.points}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(score.date).toLocaleDateString()} • {formatTime(score.timeSeconds)}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-300">
                        {score.framework}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUIZ_CATEGORIES.map(cat => {
              const count = (QUIZ_QUESTIONS[framework] || []).filter(q => q.category === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedCategory === cat.id
                      ? 'border-whs-orange-500 bg-whs-orange-50 dark:bg-whs-orange-900/20'
                      : 'border-gray-200 dark:border-whs-dark-600 hover:border-gray-300 dark:hover:border-whs-dark-500'
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-2">
                    {isEnglish ? cat.labelEn : cat.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {count} {isEnglish ? 'questions' : 'Fragen'}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Playing State */}
      {gameState === 'playing' && currentQuestion && (
        <div className="space-y-6">
          {/* Progress */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-whs-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
          </div>

          {/* Question Card */}
          <Card className="overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white/80 text-sm">{labels.question} {currentQuestionIndex + 1}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${DIFFICULTY_CONFIG[currentQuestion.difficulty].bgColor} ${DIFFICULTY_CONFIG[currentQuestion.difficulty].textColor}`}>
                    {isEnglish ? DIFFICULTY_CONFIG[currentQuestion.difficulty].labelEn : DIFFICULTY_CONFIG[currentQuestion.difficulty].label}
                  </span>
                </div>
                <span className="text-white font-bold">{currentQuestion.points} {labels.points}</span>
              </div>
            </div>

            <CardContent className="p-6">
              {/* Question Text */}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {isEnglish && currentQuestion.questionEn ? currentQuestion.questionEn : currentQuestion.question}
              </h2>

              {/* Answer Options */}
              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => !showFeedback && setCurrentAnswer(idx)}
                      disabled={showFeedback}
                      className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                        showFeedback
                          ? idx === currentQuestion.correctAnswer
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : idx === currentAnswer && !answers[currentQuestionIndex]?.isCorrect
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-whs-dark-600'
                          : currentAnswer === idx
                            ? 'border-whs-orange-500 bg-whs-orange-50 dark:bg-whs-orange-900/20'
                            : 'border-gray-200 dark:border-whs-dark-600 hover:border-gray-300 dark:hover:border-whs-dark-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          showFeedback && idx === currentQuestion.correctAnswer
                            ? 'bg-green-500 text-white'
                            : showFeedback && idx === currentAnswer && !answers[currentQuestionIndex]?.isCorrect
                              ? 'bg-red-500 text-white'
                              : currentAnswer === idx
                                ? 'bg-whs-orange-500 text-white'
                                : 'bg-gray-200 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-gray-900 dark:text-white">{option}</span>
                        {showFeedback && idx === currentQuestion.correctAnswer && (
                          <span className="ml-auto text-green-500">✓</span>
                        )}
                        {showFeedback && idx === currentAnswer && !answers[currentQuestionIndex]?.isCorrect && (
                          <span className="ml-auto text-red-500">✗</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'true_false' && (
                <div className="flex gap-4">
                  {[true, false].map((value) => (
                    <button
                      key={value.toString()}
                      onClick={() => !showFeedback && setCurrentAnswer(value)}
                      disabled={showFeedback}
                      className={`flex-1 p-6 text-center rounded-xl border-2 transition-all ${
                        showFeedback
                          ? value === currentQuestion.correctAnswer
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : value === currentAnswer && !answers[currentQuestionIndex]?.isCorrect
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-whs-dark-600'
                          : currentAnswer === value
                            ? 'border-whs-orange-500 bg-whs-orange-50 dark:bg-whs-orange-900/20'
                            : 'border-gray-200 dark:border-whs-dark-600 hover:border-gray-300 dark:hover:border-whs-dark-500'
                      }`}
                    >
                      <span className="text-4xl mb-2 block">{value ? '✅' : '❌'}</span>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {value ? labels.true : labels.false}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'fill_blank' && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={currentAnswer || ''}
                    onChange={(e) => !showFeedback && setCurrentAnswer(e.target.value)}
                    disabled={showFeedback}
                    placeholder={labels.typeAnswer}
                    className="w-full px-4 py-3 text-lg bg-white dark:bg-whs-dark-800 border-2 border-gray-200 dark:border-whs-dark-600 rounded-xl focus:outline-none focus:border-whs-orange-500 disabled:opacity-50"
                  />
                  {showFeedback && (
                    <p className="text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{labels.correctAnswer}: </span>
                      <span className="font-medium text-green-600 dark:text-green-400">{currentQuestion.correctAnswer}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Feedback */}
              {showFeedback && (
                <div className={`mt-6 p-4 rounded-xl ${
                  answers[currentQuestionIndex]?.isCorrect
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{answers[currentQuestionIndex]?.isCorrect ? '✅' : '❌'}</span>
                    <span className={`font-bold ${
                      answers[currentQuestionIndex]?.isCorrect
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}>
                      {answers[currentQuestionIndex]?.isCorrect ? labels.correct : labels.incorrect}
                    </span>
                    {answers[currentQuestionIndex]?.isCorrect && (
                      <span className="text-green-600 dark:text-green-400">+{currentQuestion.points} {labels.points}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {isEnglish && currentQuestion.explanationEn ? currentQuestion.explanationEn : currentQuestion.explanation}
                  </p>
                  {currentQuestion.lawRef && (
                    <button
                      onClick={() => handleLawClick(currentQuestion.lawRef)}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-700 dark:text-whs-orange-400 rounded-lg text-sm font-medium hover:bg-whs-orange-200 dark:hover:bg-whs-orange-900/50 transition-colors"
                    >
                      <span>📖</span>
                      {currentQuestion.lawRef.abbreviation} {currentQuestion.lawRef.section}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {/* Action Button */}
              <div className="mt-6">
                {!showFeedback ? (
                  <button
                    onClick={submitAnswer}
                    disabled={currentAnswer === null}
                    className="w-full py-3 bg-whs-orange-500 text-white font-semibold rounded-xl hover:bg-whs-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {labels.submit}
                  </button>
                ) : (
                  <button
                    onClick={nextQuestion}
                    className="w-full py-3 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 text-white font-semibold rounded-xl hover:from-whs-orange-600 hover:to-whs-orange-700 transition-all"
                  >
                    {currentQuestionIndex < questions.length - 1 ? labels.nextQuestion : labels.finishQuiz}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Result State */}
      {gameState === 'result' && (
        <div className="space-y-6">
          {/* Result Summary */}
          <Card className="overflow-hidden">
            <div className="p-8 bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 text-center">
              <span className="text-6xl mb-4 block">
                {getResultMessage(Math.round((currentScore.totalPoints / questions.reduce((s, q) => s + q.points, 0)) * 100)).emoji}
              </span>
              <h2 className="text-2xl font-bold text-white mb-2">
                {getResultMessage(Math.round((currentScore.totalPoints / questions.reduce((s, q) => s + q.points, 0)) * 100)).message}
              </h2>
              <p className="text-white/80">
                {labels.quizResults}
              </p>
            </div>

            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 dark:bg-whs-dark-800 rounded-xl">
                  <p className="text-3xl font-bold text-whs-orange-500">
                    {Math.round((currentScore.totalPoints / questions.reduce((s, q) => s + q.points, 0)) * 100)}%
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{labels.percentage}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-whs-dark-800 rounded-xl">
                  <p className="text-3xl font-bold text-green-500">
                    {currentScore.correctCount}/{questions.length}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{labels.correctAnswers}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-whs-dark-800 rounded-xl">
                  <p className="text-3xl font-bold text-blue-500">
                    {currentScore.totalPoints}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{labels.totalScore}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-whs-dark-800 rounded-xl">
                  <p className="text-3xl font-bold text-purple-500">
                    {formatTime(Math.round((endTime - startTime) / 1000))}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{labels.timeSpent}</p>
                </div>
              </div>

              {/* Question Review */}
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Fragen-Übersicht</h3>
              <div className="space-y-2 mb-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className={`flex items-center gap-3 p-3 rounded-lg ${
                    answers[idx]?.isCorrect
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}>
                    <span className="text-xl">{answers[idx]?.isCorrect ? '✅' : '❌'}</span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                      {isEnglish && q.questionEn ? q.questionEn : q.question}
                    </span>
                    {q.lawRef && (
                      <button
                        onClick={() => handleLawClick(q.lawRef)}
                        className="text-xs text-whs-orange-600 dark:text-whs-orange-400 hover:underline"
                      >
                        {q.lawRef.abbreviation}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setGameState('menu')
                    setQuestions([])
                    setAnswers({})
                  }}
                  className="flex-1 py-3 bg-gray-200 dark:bg-whs-dark-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-whs-dark-600 transition-all"
                >
                  {labels.backToMenu}
                </button>
                <button
                  onClick={startQuiz}
                  className="flex-1 py-3 bg-gradient-to-r from-whs-orange-500 to-whs-orange-600 text-white font-semibold rounded-xl hover:from-whs-orange-600 hover:to-whs-orange-700 transition-all"
                >
                  {labels.playAgain}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SafetyQuiz

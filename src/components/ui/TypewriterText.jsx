import { useState, useEffect, useRef } from 'react'

/**
 * TypewriterText - Displays text with a smooth typewriter animation
 * Used for showing translated content with a nice transition effect
 */
export function TypewriterText({
  text,
  speed = 15,
  className = '',
  onComplete,
  startDelay = 0
}) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const indexRef = useRef(0)
  const animationRef = useRef(null)

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('')
    setIsComplete(false)
    setHasStarted(false)
    indexRef.current = 0

    if (!text) return

    // Start delay
    const startTimer = setTimeout(() => {
      setHasStarted(true)
    }, startDelay)

    return () => {
      clearTimeout(startTimer)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [text, startDelay])

  useEffect(() => {
    if (!hasStarted || !text) return

    let lastTime = 0
    const msPerChar = speed

    const animate = (timestamp) => {
      if (!lastTime) lastTime = timestamp
      const elapsed = timestamp - lastTime

      if (elapsed >= msPerChar) {
        lastTime = timestamp
        indexRef.current++

        if (indexRef.current <= text.length) {
          setDisplayedText(text.slice(0, indexRef.current))
          animationRef.current = requestAnimationFrame(animate)
        } else {
          setIsComplete(true)
          if (onComplete) onComplete()
        }
      } else {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [hasStarted, text, speed, onComplete])

  // Show cursor while typing
  const cursor = !isComplete && hasStarted ? (
    <span className="animate-pulse">|</span>
  ) : null

  return (
    <span className={className}>
      {displayedText}
      {cursor}
    </span>
  )
}

/**
 * TypewriterParagraph - Renders paragraphs with typewriter effect
 * Handles multi-paragraph text properly with consistent font/paragraph styling
 */
export function TypewriterParagraph({
  text,
  speed = 10,
  className = '',
  paragraphClassName = 'text-sm leading-relaxed text-gray-700 dark:text-gray-300',
  onComplete
}) {
  const paragraphs = text ? text.split('\n').filter(p => p.trim()) : []
  const [completedParagraphs, setCompletedParagraphs] = useState(0)

  useEffect(() => {
    setCompletedParagraphs(0)
  }, [text])

  const handleParagraphComplete = (index) => {
    if (index === paragraphs.length - 1 && onComplete) {
      onComplete()
    }
    setCompletedParagraphs(prev => Math.max(prev, index + 1))
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={paragraphClassName}>
          {index <= completedParagraphs ? (
            <TypewriterText
              text={paragraph}
              speed={speed}
              startDelay={index === 0 ? 0 : 50}
              onComplete={() => handleParagraphComplete(index)}
            />
          ) : null}
        </p>
      ))}
    </div>
  )
}

/**
 * TransitionText - Smoothly transitions between original and translated text
 * with a fade + typewriter effect
 */
export function TransitionText({
  originalText,
  translatedText,
  showTranslation,
  isTranslating,
  className = ''
}) {
  if (isTranslating) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-whs-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Translating...</span>
        </div>
      </div>
    )
  }

  if (showTranslation && translatedText) {
    return (
      <div className={`${className} text-sm leading-relaxed text-gray-700 dark:text-gray-300 transition-opacity duration-300`}>
        <TypewriterText text={translatedText} speed={8} />
      </div>
    )
  }

  return (
    <div className={`${className} text-sm leading-relaxed text-gray-700 dark:text-gray-300 transition-opacity duration-300`}>
      {originalText}
    </div>
  )
}

/**
 * OverwriteText - Shows original text with translated text typing over it
 * Creates a cool effect where the translation overwrites the original character by character
 *
 * @param {string} originalText - The original text to show initially
 * @param {string} translatedText - The translated text to type over the original
 * @param {number} speed - Milliseconds per character (lower = faster)
 * @param {string} className - Additional CSS classes
 * @param {function} onComplete - Callback when animation completes
 * @param {function} renderComplete - Optional render function for formatted content after completion
 *                                    Receives translatedText as argument
 */
export function OverwriteText({
  originalText,
  translatedText,
  speed = 8,
  className = '',
  onComplete,
  renderComplete
}) {
  const [displayedLength, setDisplayedLength] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const animationRef = useRef(null)
  const indexRef = useRef(0)

  useEffect(() => {
    // Reset when text changes
    setDisplayedLength(0)
    setIsComplete(false)
    indexRef.current = 0

    if (!translatedText) return

    let lastTime = 0
    const msPerChar = speed

    const animate = (timestamp) => {
      if (!lastTime) lastTime = timestamp
      const elapsed = timestamp - lastTime

      if (elapsed >= msPerChar) {
        lastTime = timestamp
        indexRef.current++

        if (indexRef.current <= translatedText.length) {
          setDisplayedLength(indexRef.current)
          animationRef.current = requestAnimationFrame(animate)
        } else {
          setIsComplete(true)
          if (onComplete) onComplete()
        }
      } else {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    // Small delay before starting
    const startTimer = setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate)
    }, 100)

    return () => {
      clearTimeout(startTimer)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [translatedText, speed, onComplete])

  // If animation is complete and we have a custom renderer, use it for formatted display
  if (isComplete && renderComplete) {
    return (
      <div className={className}>
        {renderComplete(translatedText)}
      </div>
    )
  }

  // Split text by lines for proper display with paragraph formatting
  const displayedText = translatedText ? translatedText.slice(0, displayedLength) : ''
  const originalToShow = originalText || ''

  // Format text into paragraphs for proper styling
  const formatAsParagraphs = (text) => {
    if (!text) return null
    const paragraphs = text.split('\n').filter(p => p.trim())
    if (paragraphs.length === 0) return text
    return (
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Original text as base - visible parts that haven't been overwritten */}
      <div className="text-sm leading-relaxed text-gray-400 dark:text-gray-500 transition-opacity duration-500"
           style={{ opacity: isComplete ? 0 : 0.3 }}>
        {formatAsParagraphs(originalToShow)}
      </div>

      {/* Translated text overlay - types over the original */}
      <div className="absolute inset-0 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <span className="bg-white dark:bg-whs-dark-800">
          {displayedText}
        </span>
        {!isComplete && displayedLength > 0 && (
          <span className="inline-block w-0.5 h-4 bg-whs-orange-500 animate-pulse ml-0.5 align-middle"></span>
        )}
      </div>
    </div>
  )
}

export default TypewriterText

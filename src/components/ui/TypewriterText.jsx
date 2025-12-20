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
 * Handles multi-paragraph text properly
 */
export function TypewriterParagraph({
  text,
  speed = 10,
  className = '',
  paragraphClassName = '',
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
    <div className={className}>
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
      <div className={`${className} transition-opacity duration-300`}>
        <TypewriterText text={translatedText} speed={8} />
      </div>
    )
  }

  return (
    <div className={`${className} transition-opacity duration-300`}>
      {originalText}
    </div>
  )
}

export default TypewriterText

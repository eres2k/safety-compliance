import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import * as aiService from '../services/aiService'

export function useAI() {
  const { framework, language } = useApp()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const generateResponse = useCallback(async (prompt) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.generateAIResponse(prompt, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  const explainSection = useCallback(async (section) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.explainSection(section, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  const checkCompliance = useCallback(async (companySize, industry, topic) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.checkCompliance(companySize, industry, topic, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  const generateDocument = useCallback(async (templateName, inputs) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.generateDocument(templateName, inputs, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  const lookupRegulation = useCallback(async (topic, companySize) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.lookupRegulation(topic, companySize, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  const generateFlowchart = useCallback(async (lawText) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.generateFlowchart(lawText, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  return {
    isLoading,
    error,
    generateResponse,
    explainSection,
    checkCompliance,
    generateDocument,
    lookupRegulation,
    generateFlowchart
  }
}

export default useAI

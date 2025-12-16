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

  // Feature 2: Simplify for Manager
  const simplifyForManager = useCallback(async (lawText, sectionTitle) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.simplifyForManager(lawText, sectionTitle, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  // Feature 2: Simplify for Associate (Toolbox Talk)
  const simplifyForAssociate = useCallback(async (lawText, sectionTitle) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.simplifyForAssociate(lawText, sectionTitle, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  // Feature 2b: Combined simplification - returns BOTH manager and associate in one API call
  const simplifyForBothLevels = useCallback(async (lawText, sectionTitle) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.simplifyForBothLevels(lawText, sectionTitle, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  // Feature 3: Find equivalent law in another jurisdiction
  const findEquivalentLaw = useCallback(async (lawText, targetFramework) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.findEquivalentLaw(lawText, framework, targetFramework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  // Feature 4: Generate semantic tags for a section
  const generateSemanticTags = useCallback(async (lawText, sectionNumber) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.generateSemanticTags(lawText, sectionNumber, framework, language)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [framework, language])

  // Feature 3b: Compare law across all 3 countries
  const compareMultipleCountries = useCallback(async (lawText) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await aiService.compareMultipleCountries(lawText, framework, language)
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
    generateFlowchart,
    simplifyForManager,
    simplifyForAssociate,
    simplifyForBothLevels,
    findEquivalentLaw,
    generateSemanticTags,
    compareMultipleCountries
  }
}

export default useAI

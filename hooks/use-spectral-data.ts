/**
 * Custom Hooks for Spectral Data Management
 * 
 * React hooks that integrate the Zustand store with components,
 * providing a clean interface for data operations and workflow management.
 */

import { useCallback } from 'react'
import { useSpectralStore } from '@/lib/store'
import { 
  processRawSpectralData, 
  processScalarData, 
  validateSpectralDataAdvanced,
  validateScalarDataAdvanced,
  validateDomainAdvanced,
  validateWorkflow,
  type ParseConfig 
} from '@/lib/data-processing'
import { 
  functionalizeData,
  getDefaultParameters,
  assessFunctionalizationQuality,
  type FunctionalizationMethod,
  type FunctionalizationParams 
} from '@/lib/functionalization'
import type { DomainParameters } from '@/lib/types'

// ============================================================================
// Data Upload Hooks
// ============================================================================

export function useDataUpload() {
  const { 
    setRawData, 
    setScalarData, 
    setValidationResult,
    setProcessingState,
    settings 
  } = useSpectralStore()

  const uploadSpectralData = useCallback(async (
    file: File,
    config?: Partial<ParseConfig>,
    domainParams?: DomainParameters
  ) => {
    setProcessingState(true)
    
    try {
      const parseConfig: ParseConfig = {
        decimalSeparator: settings.decimalSeparator,
        columnSeparator: settings.columnSeparator,
        hasHeaders: settings.hasHeaders,
        encoding: settings.encoding,
        ...config
      }
      
      // Process the raw data
      const rawData = await processRawSpectralData(file, parseConfig, domainParams)
      setRawData(rawData)
      
      // Run advanced validation
      const validation = validateSpectralDataAdvanced(rawData, settings)
      setValidationResult('rawData', validation)
      
      // Run domain validation
      const domainValidation = validateDomainAdvanced(rawData, domainParams, settings)
      setValidationResult('domain', domainValidation)
      
      // Set overall validation result
      const overallValid = validation.isValid && domainValidation.isValid
      setValidationResult('overall', {
        isValid: overallValid,
        errors: [...validation.errors, ...domainValidation.errors],
        warnings: [...validation.warnings, ...domainValidation.warnings],
        suggestions: [...validation.suggestions, ...domainValidation.suggestions]
      })
      
      return { rawData, validation, domainValidation }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setValidationResult('rawData', {
        isValid: false,
        errors: [errorMessage],
        warnings: [],
        suggestions: []
      })
      throw error
    } finally {
      setProcessingState(false)
    }
  }, [setRawData, setValidationResult, setProcessingState, settings])

  const uploadScalarData = useCallback(async (
    file: File,
    config?: Partial<ParseConfig>
  ) => {
    setProcessingState(true)
    
    try {
      const parseConfig: ParseConfig = {
        decimalSeparator: settings.decimalSeparator,
        columnSeparator: settings.columnSeparator,
        hasHeaders: settings.hasHeaders,
        encoding: settings.encoding,
        ...config
      }
      
      // Process scalar data
      const scalarData = await processScalarData(file, parseConfig)
      setScalarData(scalarData)
      
      // Get current raw data for cross-validation
      const rawData = useSpectralStore.getState().rawData
      
      // Run validation
      const validation = validateScalarDataAdvanced(scalarData, rawData || undefined)
      setValidationResult('scalarData', validation)
      
      return { scalarData, validation }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setValidationResult('scalarData', {
        isValid: false,
        errors: [errorMessage],
        warnings: [],
        suggestions: []
      })
      throw error
    } finally {
      setProcessingState(false)
    }
  }, [setScalarData, setValidationResult, setProcessingState, settings])

  return {
    uploadSpectralData,
    uploadScalarData
  }
}

// ============================================================================
// Functionalization Hooks
// ============================================================================

export function useFunctionalization() {
  const {
    rawData,
    functionalBases,
    addFunctionalDataset,
    removeFunctionalDataset,
    setActiveFunctionalDataset,
    updateFunctionalDataset,
    setProcessingState,
    settings
  } = useSpectralStore()

  const createFunctionalDataset = useCallback(async (
    method: FunctionalizationMethod,
    params?: Partial<FunctionalizationParams>,
    name?: string
  ) => {
    if (!rawData) {
      throw new Error('No raw data available for functionalization')
    }

    setProcessingState(true)

    try {
      // Get default parameters and merge with provided ones
      const defaultParams = getDefaultParameters(method, rawData.wavelengths.length)
      const finalParams: FunctionalizationParams = {
        ...defaultParams,
        ...params,
        method
      }

      // Create functional dataset
      const functionalDataset = await functionalizeData(rawData, method, finalParams)
      
      // Set custom name if provided
      if (name) {
        functionalDataset.name = name
      }

      // Assess quality and add warnings if needed
      const qualityAssessment = assessFunctionalizationQuality(functionalDataset)
      
      // Add to store
      addFunctionalDataset(functionalDataset)

      return {
        dataset: functionalDataset,
        quality: qualityAssessment
      }

    } catch (error) {
      throw error
    } finally {
      setProcessingState(false)
    }
  }, [rawData, addFunctionalDataset, setProcessingState])

  const removeFunctionalDatasetById = useCallback((id: string) => {
    removeFunctionalDataset(id)
  }, [removeFunctionalDataset])

  const setActiveDataset = useCallback((index: number) => {
    setActiveFunctionalDataset(index)
  }, [setActiveFunctionalDataset])

  const updateDataset = useCallback((id: string, updates: Partial<typeof functionalBases[0]>) => {
    updateFunctionalDataset(id, updates)
  }, [updateFunctionalDataset])

  const getAvailableSlots = useCallback(() => {
    return settings.maxFunctionalDatasets - functionalBases.length
  }, [functionalBases.length, settings.maxFunctionalDatasets])

  return {
    createFunctionalDataset,
    removeFunctionalDataset: removeFunctionalDatasetById,
    setActiveDataset,
    updateDataset,
    getAvailableSlots,
    canCreateMore: getAvailableSlots() > 0
  }
}

// ============================================================================
// Workflow Management Hooks
// ============================================================================

export function useWorkflow() {
  const {
    rawData,
    scalarData,
    functionalBases,
    validationResults,
    workflowStep,
    setWorkflowStep,
    isProcessing
  } = useSpectralStore()

  const workflow = validateWorkflow(rawData, scalarData, functionalBases, validationResults)

  const proceedToStep = useCallback((step: 'upload' | 'validate' | 'functionalize' | 'analyze') => {
    const canProceed = {
      upload: true,
      validate: workflow.canProceedToValidation,
      functionalize: workflow.canProceedToFunctionalization,
      analyze: workflow.canProceedToAnalysis
    }

    if (canProceed[step]) {
      setWorkflowStep(step)
      return true
    }
    
    return false
  }, [workflow, setWorkflowStep])

  const getWorkflowProgress = useCallback(() => {
    const steps = ['upload', 'validate', 'functionalize', 'analyze']
    const currentIndex = steps.indexOf(workflowStep)
    const totalSteps = steps.length

    return {
      currentStep: workflowStep,
      currentIndex,
      totalSteps,
      progress: ((currentIndex + 1) / totalSteps) * 100,
      isComplete: currentIndex === totalSteps - 1
    }
  }, [workflowStep])

  return {
    ...workflow,
    currentStep: workflowStep,
    isProcessing,
    proceedToStep,
    getWorkflowProgress
  }
}

// ============================================================================
// Data Access Hooks
// ============================================================================

export function useSpectralDataAccess() {
  const {
    rawData,
    scalarData,
    functionalBases,
    selectedBaseIndex,
    validationResults
  } = useSpectralStore()

  const activeDataset = selectedBaseIndex >= 0 && selectedBaseIndex < functionalBases.length
    ? functionalBases[selectedBaseIndex]
    : null

  const hasValidData = rawData?.isValid && validationResults.overall?.isValid
  const hasScalarData = scalarData?.isValid
  const hasFunctionalData = functionalBases.length > 0

  const getDataSummary = useCallback(() => {
    return {
      raw: rawData ? {
        name: rawData.name,
        samples: rawData.rowCount,
        wavelengths: rawData.columnCount,
        isValid: rawData.isValid,
        uploadedAt: rawData.uploadedAt
      } : null,
      
      scalar: scalarData ? {
        name: scalarData.name,
        samples: scalarData.rowCount,
        variables: scalarData.columnCount,
        isValid: scalarData.isValid,
        uploadedAt: scalarData.uploadedAt
      } : null,
      
      functional: functionalBases.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        method: dataset.method,
        r2: dataset.r2,
        mse: dataset.mse,
        isActive: dataset.isActive,
        createdAt: dataset.createdAt
      }))
    }
  }, [rawData, scalarData, functionalBases])

  return {
    rawData,
    scalarData,
    functionalBases,
    activeDataset,
    validationResults,
    hasValidData,
    hasScalarData,
    hasFunctionalData,
    getDataSummary
  }
}

// ============================================================================
// Settings Management Hooks
// ============================================================================

export function useSettings() {
  const { settings, updateSettings } = useSpectralStore()

  const updateSetting = useCallback(<K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    updateSettings({ [key]: value })
  }, [updateSettings])

  const resetToDefaults = useCallback(() => {
    updateSettings({
      decimalSeparator: '.',
      columnSeparator: ',',
      encoding: 'utf-8',
      hasHeaders: true,
      defaultFunctionalizationMethod: 'bsplines',
      maxFunctionalDatasets: 5,
      defaultChartType: 'line',
      colorScheme: 'viridis',
      exportFormat: 'csv',
      exportPrecision: 6
    })
  }, [updateSettings])

  return {
    settings,
    updateSetting,
    updateSettings,
    resetToDefaults
  }
}

// ============================================================================
// Analysis State Hooks
// ============================================================================

export function useAnalysisState() {
  const {
    activeAnalysisModule,
    setActiveAnalysisModule,
    analysisCache,
    setCacheData,
    getCacheData,
    clearCache
  } = useSpectralStore()

  const setModule = useCallback((module: string) => {
    setActiveAnalysisModule(module)
  }, [setActiveAnalysisModule])

  const cacheAnalysisResult = useCallback((key: string, data: any) => {
    setCacheData(key, data)
  }, [setCacheData])

  const getAnalysisResult = useCallback((key: string) => {
    return getCacheData(key)
  }, [getCacheData])

  const clearAnalysisCache = useCallback(() => {
    clearCache()
  }, [clearCache])

  const generateCacheKey = useCallback((
    analysisType: string,
    datasetId: string,
    parameters?: Record<string, any>
  ) => {
    const paramString = parameters ? JSON.stringify(parameters) : ''
    return `${analysisType}_${datasetId}_${paramString}`
  }, [])

  return {
    activeModule: activeAnalysisModule,
    setModule,
    cacheAnalysisResult,
    getAnalysisResult,
    clearAnalysisCache,
    generateCacheKey,
    hasCache: Object.keys(analysisCache).length > 0
  }
}

// ============================================================================
// Combined Data Hook
// ============================================================================

export function useSpectralAnalysis() {
  const dataAccess = useSpectralDataAccess()
  const dataUpload = useDataUpload()
  const functionalization = useFunctionalization()
  const workflow = useWorkflow()
  const settings = useSettings()
  const analysisState = useAnalysisState()

  return {
    // Data access
    ...dataAccess,
    
    // Data operations
    ...dataUpload,
    ...functionalization,
    
    // Workflow management
    ...workflow,
    
    // Settings
    ...settings,
    
    // Analysis state
    ...analysisState
  }
}
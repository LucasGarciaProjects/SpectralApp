/**
 * Global State Management for Spectral Data Analysis Application
 * 
 * Uses Zustand for efficient, type-safe state management with persistence
 * and middleware for debugging in development.
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type {
  SpectralAnalysisState,
  SpectralAnalysisActions,
  RawSpectralData,
  ScalarData,
  FunctionalDataset,
  AppSettings,
  ValidationResult,
  DomainValidation,
  ProcessingJob
} from './types'

// ============================================================================
// Initial State
// ============================================================================

const initialSettings: AppSettings = {
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
}

const initialState: SpectralAnalysisState = {
  // Raw data management
  rawData: null,
  scalarData: null,
  
  // Functionalized datasets
  functionalBases: [],
  selectedBaseIndex: -1,
  
  // Application settings
  settings: initialSettings,
  
  // Workflow state
  workflowStep: 'upload',
  isProcessing: false,
  
  // Validation results
  validationResults: {
    rawData: null,
    scalarData: null,
    domain: null,
    overall: null
  },
  
  // UI state
  activeAnalysisModule: 'overview',
  sidebarCollapsed: false,
  
  // Analysis cache
  analysisCache: {}
}

// ============================================================================
// Store Definition
// ============================================================================

export const useSpectralStore = create<SpectralAnalysisState & SpectralAnalysisActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ========================================================================
        // Raw Data Actions
        // ========================================================================

        setRawData: (data: RawSpectralData) => {
          set(
            (state) => ({
              rawData: data,
              workflowStep: 'validate',
              // Clear previous validation results when new data is uploaded
              validationResults: {
                ...state.validationResults,
                rawData: null,
                domain: null,
                overall: null
              },
              // Clear functional datasets when raw data changes
              functionalBases: [],
              selectedBaseIndex: -1
            }),
            false,
            'setRawData'
          )
        },

        setScalarData: (data: ScalarData | null) => {
          set(
            (state) => ({
              scalarData: data,
              validationResults: {
                ...state.validationResults,
                scalarData: null,
                overall: null
              }
            }),
            false,
            'setScalarData'
          )
        },

        clearRawData: () => {
          set(
            () => ({
              rawData: null,
              scalarData: null,
              functionalBases: [],
              selectedBaseIndex: -1,
              workflowStep: 'upload',
              validationResults: {
                rawData: null,
                scalarData: null,
                domain: null,
                overall: null
              },
              analysisCache: {}
            }),
            false,
            'clearRawData'
          )
        },

        // ========================================================================
        // Functionalization Actions
        // ========================================================================

        addFunctionalDataset: (dataset: FunctionalDataset) => {
          set(
            (state) => {
              const newBases = [...state.functionalBases, dataset]
              
              // Enforce maximum of 5 functional datasets
              if (newBases.length > state.settings.maxFunctionalDatasets) {
                newBases.shift() // Remove oldest dataset
              }
              
              return {
                functionalBases: newBases,
                selectedBaseIndex: newBases.length - 1, // Select newly added dataset
                workflowStep: 'analyze'
              }
            },
            false,
            'addFunctionalDataset'
          )
        },

        removeFunctionalDataset: (id: string) => {
          set(
            (state) => {
              const datasetIndex = state.functionalBases.findIndex(d => d.id === id)
              if (datasetIndex === -1) return state
              
              const newBases = state.functionalBases.filter(d => d.id !== id)
              let newSelectedIndex = state.selectedBaseIndex
              
              // Adjust selected index if necessary
              if (datasetIndex === state.selectedBaseIndex) {
                newSelectedIndex = newBases.length > 0 ? 0 : -1
              } else if (datasetIndex < state.selectedBaseIndex) {
                newSelectedIndex = state.selectedBaseIndex - 1
              }
              
              return {
                functionalBases: newBases,
                selectedBaseIndex: newSelectedIndex,
                workflowStep: newBases.length === 0 ? 'functionalize' : 'analyze'
              }
            },
            false,
            'removeFunctionalDataset'
          )
        },

        setActiveFunctionalDataset: (index: number) => {
          set(
            (state) => {
              if (index >= 0 && index < state.functionalBases.length) {
                return { selectedBaseIndex: index }
              }
              return state
            },
            false,
            'setActiveFunctionalDataset'
          )
        },

        updateFunctionalDataset: (id: string, updates: Partial<FunctionalDataset>) => {
          set(
            (state) => ({
              functionalBases: state.functionalBases.map(dataset =>
                dataset.id === id ? { ...dataset, ...updates } : dataset
              )
            }),
            false,
            'updateFunctionalDataset'
          )
        },

        // ========================================================================
        // Settings Actions
        // ========================================================================

        updateSettings: (newSettings: Partial<AppSettings>) => {
          set(
            (state) => ({
              settings: { ...state.settings, ...newSettings }
            }),
            false,
            'updateSettings'
          )
        },

        // ========================================================================
        // Workflow Actions
        // ========================================================================

        setWorkflowStep: (step: SpectralAnalysisState['workflowStep']) => {
          set(
            () => ({ workflowStep: step }),
            false,
            'setWorkflowStep'
          )
        },

        setProcessingState: (isProcessing: boolean) => {
          set(
            () => ({ isProcessing }),
            false,
            'setProcessingState'
          )
        },

        // ========================================================================
        // Validation Actions
        // ========================================================================

        setValidationResult: (
          type: 'rawData' | 'scalarData' | 'domain' | 'overall',
          result: ValidationResult | DomainValidation
        ) => {
          set(
            (state) => ({
              validationResults: {
                ...state.validationResults,
                [type]: result
              }
            }),
            false,
            'setValidationResult'
          )
        },

        // ========================================================================
        // UI Actions
        // ========================================================================

        setActiveAnalysisModule: (module: string) => {
          set(
            () => ({ activeAnalysisModule: module }),
            false,
            'setActiveAnalysisModule'
          )
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set(
            () => ({ sidebarCollapsed: collapsed }),
            false,
            'setSidebarCollapsed'
          )
        },

        // ========================================================================
        // Cache Actions
        // ========================================================================

        setCacheData: (key: string, data: any) => {
          set(
            (state) => ({
              analysisCache: { ...state.analysisCache, [key]: data }
            }),
            false,
            'setCacheData'
          )
        },

        getCacheData: (key: string) => {
          return get().analysisCache[key]
        },

        clearCache: () => {
          set(
            () => ({ analysisCache: {} }),
            false,
            'clearCache'
          )
        },

        // ========================================================================
        // Utility Actions
        // ========================================================================

        reset: () => {
          set(
            () => ({ ...initialState }),
            false,
            'reset'
          )
        },

        exportState: () => {
          const state = get()
          return JSON.stringify({
            rawData: state.rawData,
            scalarData: state.scalarData,
            functionalBases: state.functionalBases,
            selectedBaseIndex: state.selectedBaseIndex,
            settings: state.settings,
            validationResults: state.validationResults
          }, null, 2)
        },

        importState: (stateJson: string) => {
          try {
            const importedState = JSON.parse(stateJson)
            set(
              (state) => ({
                ...state,
                ...importedState,
                // Reset UI state and processing flags
                isProcessing: false,
                workflowStep: importedState.rawData ? 'analyze' : 'upload',
                activeAnalysisModule: 'overview'
              }),
              false,
              'importState'
            )
          } catch (error) {
            console.error('Failed to import state:', error)
          }
        }
      }),
      {
        name: 'spectral-analysis-storage',
        partialize: (state) => ({
          // Only persist certain parts of the state
          settings: state.settings,
          sidebarCollapsed: state.sidebarCollapsed,
          activeAnalysisModule: state.activeAnalysisModule
        })
      }
    ),
    {
      name: 'SpectralAnalysisStore'
    }
  )
)

// ============================================================================
// Computed Selectors (Custom Hooks)
// ============================================================================

export const useActiveDataset = () => {
  return useSpectralStore((state) => {
    if (state.selectedBaseIndex >= 0 && state.selectedBaseIndex < state.functionalBases.length) {
      return state.functionalBases[state.selectedBaseIndex]
    }
    return null
  })
}

export const useHasValidData = () => {
  return useSpectralStore((state) => {
    return state.rawData !== null && 
           state.validationResults.rawData?.isValid === true &&
           state.validationResults.domain?.isValid === true
  })
}

export const useCanFunctionalize = () => {
  return useSpectralStore((state) => {
    return state.rawData !== null && 
           state.validationResults.rawData?.isValid === true &&
           state.validationResults.domain?.isValid === true
  })
}

export const useCanAnalyze = () => {
  return useSpectralStore((state) => {
    return state.functionalBases.length > 0 && state.selectedBaseIndex >= 0
  })
}

export const useWorkflowProgress = () => {
  return useSpectralStore((state) => {
    const steps = ['upload', 'validate', 'functionalize', 'analyze']
    const currentIndex = steps.indexOf(state.workflowStep)
    return {
      currentStep: state.workflowStep,
      progress: ((currentIndex + 1) / steps.length) * 100,
      canProceed: {
        validate: state.rawData !== null,
        functionalize: state.validationResults.overall?.isValid === true,
        analyze: state.functionalBases.length > 0
      }
    }
  })
}
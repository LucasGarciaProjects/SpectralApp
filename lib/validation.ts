/**
 * Advanced Validation Logic for Spectral Data Analysis
 * 
 * Comprehensive validation system for raw data, domain parameters,
 * scalar variables, and workflow state transitions.
 */

import type {
  RawSpectralData,
  ScalarData,
  ValidationResult,
  DomainValidation,
  DomainParameters,
  FunctionalDataset,
  AppSettings
} from './types'

// ============================================================================
// Workflow Validation
// ============================================================================

export interface WorkflowValidation {
  canProceedToValidation: boolean
  canProceedToFunctionalization: boolean
  canProceedToAnalysis: boolean
  blockers: string[]
  warnings: string[]
}

export function validateWorkflow(
  rawData: RawSpectralData | null,
  scalarData: ScalarData | null,
  functionalBases: FunctionalDataset[],
  validationResults: {
    rawData: ValidationResult | null
    scalarData: ValidationResult | null
    domain: DomainValidation | null
    overall: ValidationResult | null
  }
): WorkflowValidation {
  const blockers: string[] = []
  const warnings: string[] = []
  
  // Check if we can proceed to validation step
  const canProceedToValidation = rawData !== null
  if (!canProceedToValidation) {
    blockers.push('Raw spectral data must be uploaded first')
  }
  
  // Check if we can proceed to functionalization
  const canProceedToFunctionalization = 
    rawData !== null &&
    rawData.isValid &&
    validationResults.rawData?.isValid === true &&
    validationResults.domain?.isValid === true
    
  if (rawData && !rawData.isValid) {
    blockers.push('Raw data contains errors that must be resolved')
  }
  
  if (validationResults.rawData && !validationResults.rawData.isValid) {
    blockers.push('Data validation failed - check data format and content')
  }
  
  if (validationResults.domain && !validationResults.domain.isValid) {
    blockers.push('Domain validation failed - check wavelength range and sampling')
  }
  
  // Check if we can proceed to analysis
  const canProceedToAnalysis = 
    canProceedToFunctionalization &&
    functionalBases.length > 0
    
  if (canProceedToFunctionalization && functionalBases.length === 0) {
    blockers.push('At least one functional dataset must be created before analysis')
  }
  
  // Add warnings for incomplete but non-blocking issues
  if (scalarData && validationResults.scalarData && !validationResults.scalarData.isValid) {
    warnings.push('Scalar data has validation issues - some analyses may be limited')
  }
  
  if (functionalBases.length > 0) {
    const lowQualityBases = functionalBases.filter(base => base.r2 < 0.8)
    if (lowQualityBases.length > 0) {
      warnings.push(`${lowQualityBases.length} functional datasets have low R² values`)
    }
  }
  
  return {
    canProceedToValidation,
    canProceedToFunctionalization,
    canProceedToAnalysis,
    blockers,
    warnings
  }
}

// ============================================================================
// Enhanced Data Validation
// ============================================================================

export function validateSpectralDataAdvanced(
  data: RawSpectralData,
  settings: AppSettings
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  
  // Basic validation first
  if (!data.spectra || data.spectra.length === 0) {
    return {
      isValid: false,
      errors: ['No spectral data found'],
      warnings: [],
      suggestions: ['Ensure the file contains numerical spectral data']
    }
  }
  
  // Dimensional consistency
  const expectedCols = data.wavelengths?.length || 0
  const inconsistentRows = data.spectra.filter(row => row.length !== expectedCols)
  
  if (inconsistentRows.length > 0) {
    errors.push(`${inconsistentRows.length} rows have inconsistent column counts`)
    suggestions.push('Check for missing values or formatting issues in the data file')
  }
  
  // Data quality checks
  let totalValues = 0
  let nanValues = 0
  let infiniteValues = 0
  let negativeValues = 0
  let zeroValues = 0
  
  data.spectra.forEach(row => {
    row.forEach(value => {
      totalValues++
      
      if (isNaN(value)) {
        nanValues++
      } else if (!isFinite(value)) {
        infiniteValues++
      } else {
        if (value < 0) negativeValues++
        if (value === 0) zeroValues++
      }
    })
  })
  
  // Check for problematic values
  if (nanValues > 0) {
    if (nanValues / totalValues > 0.1) {
      errors.push(`High proportion of missing values: ${((nanValues / totalValues) * 100).toFixed(1)}%`)
    } else {
      warnings.push(`Found ${nanValues} missing values (${((nanValues / totalValues) * 100).toFixed(1)}%)`)
      suggestions.push('Consider interpolation or imputation for missing values')
    }
  }
  
  if (infiniteValues > 0) {
    errors.push(`Found ${infiniteValues} infinite values`)
    suggestions.push('Check for division by zero or overflow in data processing')
  }
  
  if (negativeValues / totalValues > 0.5) {
    warnings.push('More than 50% of values are negative - unusual for spectral data')
    suggestions.push('Verify data preprocessing and baseline correction')
  }
  
  if (zeroValues / totalValues > 0.3) {
    warnings.push('High proportion of zero values detected')
    suggestions.push('Check for instrument issues or preprocessing artifacts')
  }
  
  // Statistical checks
  const spectrumMeans = data.spectra.map(spectrum => 
    spectrum.reduce((sum, val) => sum + (isFinite(val) ? val : 0), 0) / spectrum.length
  )
  
  const overallMean = spectrumMeans.reduce((sum, mean) => sum + mean, 0) / spectrumMeans.length
  const meanStd = Math.sqrt(
    spectrumMeans.reduce((sum, mean) => sum + Math.pow(mean - overallMean, 2), 0) / spectrumMeans.length
  )
  
  if (meanStd / overallMean > 2) {
    warnings.push('High variability in spectrum intensities detected')
    suggestions.push('Consider normalization or scaling of spectra')
  }
  
  // Wavelength checks
  if (data.wavelengths && data.wavelengths.length > 1) {
    const wavelengthDiffs = data.wavelengths.slice(1).map((w, i) => w - data.wavelengths[i])
    const avgDiff = wavelengthDiffs.reduce((sum, diff) => sum + diff, 0) / wavelengthDiffs.length
    
    // Check for irregular spacing
    const irregularPoints = wavelengthDiffs.filter(diff => Math.abs(diff - avgDiff) > Math.abs(avgDiff) * 0.1)
    
    if (irregularPoints.length > wavelengthDiffs.length * 0.1) {
      warnings.push('Irregular wavelength spacing detected')
      suggestions.push('Consider interpolation to regular grid for some analyses')
    }
    
    // Check wavelength range
    const range = Math.max(...data.wavelengths) - Math.min(...data.wavelengths)
    if (range < 100) {
      warnings.push('Narrow wavelength range may limit analysis options')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// Enhanced Domain Validation
// ============================================================================

export function validateDomainAdvanced(
  data: RawSpectralData,
  params?: DomainParameters,
  settings?: AppSettings
): DomainValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  
  if (!data.wavelengths || data.wavelengths.length === 0) {
    return {
      isValid: false,
      errors: ['No wavelength data available'],
      warnings: [],
      suggestions: ['Ensure wavelength information is provided'],
      wavelengthRange: [0, 0],
      samplingRegularity: 'irregular',
      missingValues: 0,
      duplicateWavelengths: []
    }
  }
  
  const wavelengths = data.wavelengths
  const wavelengthRange: [number, number] = [
    Math.min(...wavelengths),
    Math.max(...wavelengths)
  ]
  
  // Duplicate detection with tolerance
  const tolerance = 1e-6
  const duplicates: number[] = []
  const seen = new Map<string, number>()
  
  wavelengths.forEach((w, index) => {
    const key = w.toFixed(6) // Use fixed precision for comparison
    if (seen.has(key)) {
      duplicates.push(w)
    } else {
      seen.set(key, index)
    }
  })
  
  if (duplicates.length > 0) {
    errors.push(`Found ${duplicates.length} duplicate wavelengths`)
    suggestions.push('Remove or average duplicate wavelength points')
  }
  
  // Detailed sampling analysis
  let samplingRegularity: 'regular' | 'irregular' = 'regular'
  
  if (wavelengths.length > 2) {
    const steps = wavelengths.slice(1).map((w, i) => w - wavelengths[i])
    const avgStep = steps.reduce((sum, step) => sum + step, 0) / steps.length
    const stepVariance = steps.reduce((sum, step) => sum + Math.pow(step - avgStep, 2), 0) / steps.length
    const stepCV = Math.sqrt(stepVariance) / Math.abs(avgStep)
    
    if (stepCV > 0.05) { // 5% coefficient of variation threshold
      samplingRegularity = 'irregular'
      warnings.push(`Irregular sampling detected (CV: ${(stepCV * 100).toFixed(1)}%)`)
      suggestions.push('Consider interpolation to regular grid for optimal analysis')
    }
    
    // Check for monotonicity
    const isMonotonic = steps.every(step => step > 0) || steps.every(step => step < 0)
    if (!isMonotonic) {
      errors.push('Wavelengths are not monotonically ordered')
      suggestions.push('Sort wavelengths in ascending or descending order')
    }
    
    // Check for reasonable step sizes
    if (Math.abs(avgStep) < 0.01) {
      warnings.push('Very small wavelength steps may cause numerical issues')
    }
    if (Math.abs(avgStep) > 100) {
      warnings.push('Very large wavelength steps may cause aliasing')
    }
  }
  
  // Count missing values in spectral data
  let missingValues = 0
  data.spectra.forEach(spectrum => {
    spectrum.forEach(value => {
      if (isNaN(value) || !isFinite(value)) {
        missingValues++
      }
    })
  })
  
  // Domain parameter validation
  if (params) {
    const { startWavelength, endWavelength, stepSize, units } = params
    
    // Range checks
    if (wavelengthRange[0] > startWavelength) {
      warnings.push(
        `Data starts at ${wavelengthRange[0].toFixed(2)} but domain starts at ${startWavelength.toFixed(2)}`
      )
    }
    
    if (wavelengthRange[1] < endWavelength) {
      warnings.push(
        `Data ends at ${wavelengthRange[1].toFixed(2)} but domain ends at ${endWavelength.toFixed(2)}`
      )
    }
    
    // Step size validation for regular sampling
    if (stepSize && samplingRegularity === 'regular') {
      const actualSteps = wavelengths.slice(1).map((w, i) => w - wavelengths[i])
      const avgActualStep = actualSteps.reduce((sum, step) => sum + step, 0) / actualSteps.length
      
      if (Math.abs(avgActualStep - stepSize) > stepSize * 0.1) {
        warnings.push(
          `Actual step size (${avgActualStep.toFixed(3)}) differs from specified (${stepSize.toFixed(3)})`
        )
      }
    }
    
    // Units validation
    if (units && units !== 'other') {
      const rangeSize = wavelengthRange[1] - wavelengthRange[0]
      
      switch (units) {
        case 'nm':
          if (rangeSize > 10000) {
            warnings.push('Wavelength range seems too large for nanometers')
          }
          if (wavelengthRange[0] < 100 || wavelengthRange[1] > 3000) {
            warnings.push('Wavelength range outside typical visible/NIR spectrum')
          }
          break
          
        case 'cm-1':
          if (rangeSize > 5000) {
            warnings.push('Wavenumber range seems very large')
          }
          if (wavelengthRange[0] < 400 || wavelengthRange[1] > 4000) {
            warnings.push('Wavenumber range outside typical IR spectrum')
          }
          break
          
        case 'hz':
          if (wavelengthRange[0] < 1e12 || wavelengthRange[1] > 1e15) {
            warnings.push('Frequency range outside typical electromagnetic spectrum')
          }
          break
      }
    }
  }
  
  // Quality assessment
  const qualityScore = calculateDomainQuality(wavelengths, data.spectra)
  if (qualityScore < 0.7) {
    warnings.push(`Domain quality score: ${(qualityScore * 100).toFixed(0)}%`)
    suggestions.push('Consider data preprocessing to improve quality')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    wavelengthRange,
    samplingRegularity,
    missingValues,
    duplicateWavelengths: duplicates
  }
}

// ============================================================================
// Enhanced Scalar Data Validation
// ============================================================================

export function validateScalarDataAdvanced(
  data: ScalarData,
  spectralData?: RawSpectralData
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  
  if (!data.data || Object.keys(data.data).length === 0) {
    return {
      isValid: false,
      errors: ['No scalar data found'],
      warnings: [],
      suggestions: ['Ensure the file contains valid scalar variables']
    }
  }
  
  const columnNames = Object.keys(data.data)
  
  // Check row count consistency with spectral data
  if (spectralData) {
    const scalarRowCount = data.data[columnNames[0]]?.length || 0
    const spectralRowCount = spectralData.spectra.length
    
    if (scalarRowCount !== spectralRowCount) {
      errors.push(
        `Scalar data has ${scalarRowCount} rows but spectral data has ${spectralRowCount} rows`
      )
      suggestions.push('Ensure scalar and spectral data have matching sample counts')
    }
  }
  
  // Column-specific validation
  columnNames.forEach(colName => {
    const column = data.data[colName]
    const colType = data.columnTypes[colName]
    
    if (!column || column.length === 0) {
      warnings.push(`Column '${colName}' is empty`)
      return
    }
    
    // Missing value analysis
    const missingCount = column.filter(val => 
      val === null || val === undefined || val === '' || 
      (typeof val === 'number' && isNaN(val))
    ).length
    
    const missingRate = missingCount / column.length
    
    if (missingRate > 0.5) {
      warnings.push(`Column '${colName}' has ${(missingRate * 100).toFixed(1)}% missing values`)
      suggestions.push(`Consider removing or imputing missing values in '${colName}'`)
    } else if (missingRate > 0.1) {
      warnings.push(`Column '${colName}' has ${(missingRate * 100).toFixed(1)}% missing values`)
    }
    
    // Type-specific validation
    if (colType === 'numeric') {
      const numericValues = column.filter(val => typeof val === 'number' && isFinite(val)) as number[]
      
      if (numericValues.length > 0) {
        const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length
        const variance = numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericValues.length
        const std = Math.sqrt(variance)
        
        // Check for outliers (values > 3 std from mean)
        const outliers = numericValues.filter(val => Math.abs(val - mean) > 3 * std)
        if (outliers.length > 0) {
          warnings.push(`Column '${colName}' has ${outliers.length} potential outliers`)
        }
        
        // Check for constant values
        if (std < 1e-10) {
          warnings.push(`Column '${colName}' has constant or near-constant values`)
          suggestions.push(`Consider removing '${colName}' as it provides no variation`)
        }
      }
    } else if (colType === 'categorical') {
      const uniqueValues = new Set(column.filter(val => val !== null && val !== undefined && val !== ''))
      
      if (uniqueValues.size === 1) {
        warnings.push(`Column '${colName}' has only one unique value`)
        suggestions.push(`Consider removing '${colName}' as it provides no variation`)
      } else if (uniqueValues.size > column.length * 0.8) {
        warnings.push(`Column '${colName}' has very high cardinality for a categorical variable`)
        suggestions.push(`Consider if '${colName}' should be treated as text rather than categorical`)
      }
      
      // Check for imbalanced categories
      const valueCounts = new Map<string, number>()
      column.forEach(val => {
        const key = String(val)
        valueCounts.set(key, (valueCounts.get(key) || 0) + 1)
      })
      
      const counts = Array.from(valueCounts.values())
      const maxCount = Math.max(...counts)
      const minCount = Math.min(...counts)
      
      if (maxCount > minCount * 10) {
        warnings.push(`Column '${colName}' has imbalanced categories`)
        suggestions.push(`Consider handling class imbalance for '${colName}'`)
      }
    }
  })
  
  // Cross-column validation
  const numericColumns = columnNames.filter(col => data.columnTypes[col] === 'numeric')
  
  if (numericColumns.length > 1) {
    // Check for highly correlated variables
    const correlations = calculateCorrelations(data.data, numericColumns)
    const highCorrelations = correlations.filter(corr => Math.abs(corr.value) > 0.95)
    
    if (highCorrelations.length > 0) {
      warnings.push(`Found ${highCorrelations.length} pairs of highly correlated variables`)
      suggestions.push('Consider removing redundant variables to avoid multicollinearity')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// Functional Dataset Validation
// ============================================================================

export function validateFunctionalDataset(dataset: FunctionalDataset): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  
  // Check basic structure
  if (!dataset.coefficients || dataset.coefficients.length === 0) {
    errors.push('No coefficients found in functional dataset')
    return { isValid: false, errors, warnings, suggestions }
  }
  
  if (!dataset.basisFunctions || dataset.basisFunctions.length === 0) {
    errors.push('No basis functions found in functional dataset')
    return { isValid: false, errors, warnings, suggestions }
  }
  
  // Dimensional consistency
  const nObservations = dataset.coefficients.length
  const nBasisFunctions = dataset.coefficients[0]?.length || 0
  const nEvaluationPoints = dataset.evaluationPoints.length
  
  if (dataset.basisFunctions.length !== nEvaluationPoints) {
    errors.push('Basis functions length does not match evaluation points')
  }
  
  if (dataset.fittedValues.length !== nObservations) {
    errors.push('Fitted values count does not match number of observations')
  }
  
  // Quality metrics validation
  if (dataset.r2 < 0 || dataset.r2 > 1) {
    warnings.push('R² value is outside expected range [0, 1]')
  }
  
  if (dataset.r2 < 0.5) {
    warnings.push('Low R² indicates poor fit quality')
    suggestions.push('Consider adjusting functionalization parameters')
  }
  
  if (dataset.mse < 0) {
    errors.push('Mean squared error cannot be negative')
  }
  
  // Method-specific validation
  switch (dataset.method) {
    case 'bsplines':
      if (nBasisFunctions < 3) {
        warnings.push('Very few B-spline basis functions may cause poor fit')
      }
      if (nBasisFunctions > nEvaluationPoints / 2) {
        warnings.push('Too many B-spline basis functions may cause overfitting')
      }
      break
      
    case 'fourier':
      if (nBasisFunctions < 3) {
        warnings.push('Very few Fourier harmonics may cause poor fit')
      }
      break
      
    case 'wavelet':
      const maxLevels = Math.floor(Math.log2(nEvaluationPoints))
      const actualLevels = dataset.parameters.nLevels || 0
      if (actualLevels > maxLevels) {
        warnings.push('Too many wavelet levels for data length')
      }
      break
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateDomainQuality(wavelengths: number[], spectra: number[][]): number {
  let score = 1.0
  
  // Penalize irregular sampling
  if (wavelengths.length > 2) {
    const steps = wavelengths.slice(1).map((w, i) => w - wavelengths[i])
    const avgStep = steps.reduce((sum, step) => sum + step, 0) / steps.length
    const stepVariance = steps.reduce((sum, step) => sum + Math.pow(step - avgStep, 2), 0) / steps.length
    const stepCV = Math.sqrt(stepVariance) / Math.abs(avgStep)
    
    score *= Math.max(0.5, 1 - stepCV)
  }
  
  // Penalize missing values
  let totalValues = 0
  let validValues = 0
  
  spectra.forEach(spectrum => {
    spectrum.forEach(value => {
      totalValues++
      if (isFinite(value)) validValues++
    })
  })
  
  score *= validValues / totalValues
  
  return Math.max(0, Math.min(1, score))
}

function calculateCorrelations(
  data: Record<string, (string | number)[]>,
  numericColumns: string[]
): Array<{ col1: string; col2: string; value: number }> {
  const correlations: Array<{ col1: string; col2: string; value: number }> = []
  
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i]
      const col2 = numericColumns[j]
      
      const values1 = data[col1].filter(val => typeof val === 'number' && isFinite(val)) as number[]
      const values2 = data[col2].filter(val => typeof val === 'number' && isFinite(val)) as number[]
      
      if (values1.length === values2.length && values1.length > 1) {
        const correlation = pearsonCorrelation(values1, values2)
        correlations.push({ col1, col2, value: correlation })
      }
    }
  }
  
  return correlations
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n !== y.length || n === 0) return 0
  
  const meanX = x.reduce((sum, val) => sum + val, 0) / n
  const meanY = y.reduce((sum, val) => sum + val, 0) / n
  
  let numerator = 0
  let denomX = 0
  let denomY = 0
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  
  const denom = Math.sqrt(denomX * denomY)
  return denom === 0 ? 0 : numerator / denom
}
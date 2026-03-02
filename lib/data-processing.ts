/**
 * Data Processing and Validation Utilities
 * 
 * Core logic for processing raw spectral data, validation,
 * and preparing data for functionalization.
 */

import type {
  RawSpectralData,
  ScalarData,
  ValidationResult,
  DomainValidation,
  DomainParameters
} from './types'

// ============================================================================
// CSV Parsing Utilities
// ============================================================================

export interface ParseConfig {
  decimalSeparator: '.' | ','
  columnSeparator: ',' | ';' | '\t'
  hasHeaders: boolean
  encoding: 'utf-8' | 'latin1'
}

export function parseCSVContent(
  content: string,
  config: ParseConfig
): { data: string[][], headers: string[] } {
  // Normalize line endings and split into lines
  const lines = content.replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    throw new Error('File is empty')
  }
  
  // Determine separator if not explicitly set
  let separator = config.columnSeparator
  if (separator === '\t') {
    separator = '\t'
  }
  
  // Parse lines into rows
  const rows = lines.map(line => {
    // Handle quoted values and separators
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === separator && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  })
  
  // Extract headers if present
  let headers: string[] = []
  let dataRows = rows
  
  if (config.hasHeaders && rows.length > 0) {
    headers = rows[0]
    dataRows = rows.slice(1)
  } else {
    // Generate default headers
    const columnCount = rows[0]?.length || 0
    headers = Array.from({ length: columnCount }, (_, i) => `Column_${i + 1}`)
  }
  
  return { data: dataRows, headers }
}

export function normalizeDecimalSeparator(
  value: string,
  fromSeparator: '.' | ','
): string {
  if (fromSeparator === ',') {
    return value.replace(/,/g, '.')
  }
  return value
}

// ============================================================================
// Raw Spectral Data Processing
// ============================================================================

export async function processRawSpectralData(
  file: File,
  config: ParseConfig,
  domainParams?: DomainParameters
): Promise<RawSpectralData> {
  const id = generateId()
  const content = await file.text()
  
  try {
    const { data, headers } = parseCSVContent(content, config)
    
    if (data.length === 0) {
      throw new Error('No data rows found')
    }
    
    // Process wavelengths and spectra
    let wavelengths: number[] = []
    let spectra: number[][] = []
    
    if (domainParams) {
      // Generate wavelengths from domain parameters
      wavelengths = generateWavelengthGrid(domainParams)
      
      if (wavelengths.length !== data[0].length) {
        throw new Error(
          `Domain parameters generate ${wavelengths.length} wavelengths, ` +
          `but data has ${data[0].length} columns`
        )
      }
    } else {
      // Extract wavelengths from first row or generate indices
      const firstRow = data[0]
      
      // Try to parse first row as wavelengths
      const parsedWavelengths = firstRow.map(val => {
        const normalized = normalizeDecimalSeparator(val, config.decimalSeparator)
        const num = parseFloat(normalized)
        return isNaN(num) ? null : num
      })
      
      if (parsedWavelengths.every(w => w !== null)) {
        wavelengths = parsedWavelengths as number[]
        spectra = data.slice(1).map(row => 
          row.map(val => {
            const normalized = normalizeDecimalSeparator(val, config.decimalSeparator)
            const num = parseFloat(normalized)
            if (isNaN(num)) {
              throw new Error(`Invalid numeric value: ${val}`)
            }
            return num
          })
        )
      } else {
        // Treat all rows as spectra, generate wavelength indices
        wavelengths = Array.from({ length: data[0].length }, (_, i) => i + 1)
        spectra = data.map(row => 
          row.map(val => {
            const normalized = normalizeDecimalSeparator(val, config.decimalSeparator)
            const num = parseFloat(normalized)
            if (isNaN(num)) {
              throw new Error(`Invalid numeric value: ${val}`)
            }
            return num
          })
        )
      }
    }
    
    // Create preview (first 10 rows, first 10 columns)
    const preview = data.slice(0, 10).map(row => row.slice(0, 10))
    
    const result: RawSpectralData = {
      id,
      name: file.name,
      content,
      preview,
      headers,
      hasHeaders: config.hasHeaders,
      rowCount: spectra.length,
      columnCount: wavelengths.length,
      wavelengths,
      spectra,
      isValid: true,
      errors: [],
      warnings: [],
      uploadedAt: new Date()
    }
    
    // Run validation
    const validation = validateSpectralData(result)
    result.isValid = validation.isValid
    result.errors = validation.errors
    result.warnings = validation.warnings
    
    return result
    
  } catch (error) {
    return {
      id,
      name: file.name,
      content,
      preview: [],
      headers: [],
      hasHeaders: config.hasHeaders,
      rowCount: 0,
      columnCount: 0,
      wavelengths: [],
      spectra: [],
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      warnings: [],
      uploadedAt: new Date()
    }
  }
}

export function generateWavelengthGrid(params: DomainParameters): number[] {
  const { startWavelength, endWavelength, stepSize } = params
  
  if (!stepSize) {
    throw new Error('Step size is required for regular sampling')
  }
  
  if (stepSize <= 0) {
    throw new Error('Step size must be positive')
  }
  
  if (startWavelength >= endWavelength) {
    throw new Error('Start wavelength must be less than end wavelength')
  }
  
  const wavelengths: number[] = []
  for (let w = startWavelength; w <= endWavelength; w += stepSize) {
    wavelengths.push(Math.round(w * 100) / 100) // Round to 2 decimal places
  }
  
  return wavelengths
}

// ============================================================================
// Scalar Data Processing
// ============================================================================

export async function processScalarData(
  file: File,
  config: ParseConfig
): Promise<ScalarData> {
  const id = generateId()
  const content = await file.text()
  
  try {
    const { data, headers } = parseCSVContent(content, config)
    
    if (data.length === 0) {
      throw new Error('No data rows found')
    }
    
    // Process data and infer column types
    const processedData: Record<string, (string | number)[]> = {}
    const columnTypes: Record<string, 'numeric' | 'categorical' | 'text'> = {}
    
    headers.forEach((header, colIndex) => {
      const columnData = data.map(row => row[colIndex] || '')
      
      // Try to convert to numbers
      const numericData = columnData.map(val => {
        if (val === '' || val === null || val === undefined) return null
        const normalized = normalizeDecimalSeparator(val, config.decimalSeparator)
        const num = parseFloat(normalized)
        return isNaN(num) ? null : num
      })
      
      // Determine column type
      const validNumbers = numericData.filter(n => n !== null)
      const totalValues = columnData.filter(val => val !== '').length
      
      if (validNumbers.length === totalValues && totalValues > 0) {
        // All values are numeric
        columnTypes[header] = 'numeric'
        processedData[header] = numericData.map(n => n ?? 0)
      } else if (validNumbers.length > totalValues * 0.8) {
        // Mostly numeric (>80%)
        columnTypes[header] = 'numeric'
        processedData[header] = numericData.map(n => n ?? 0)
      } else {
        // Categorical or text
        const uniqueValues = new Set(columnData.filter(val => val !== ''))
        if (uniqueValues.size <= Math.max(10, totalValues * 0.1)) {
          columnTypes[header] = 'categorical'
        } else {
          columnTypes[header] = 'text'
        }
        processedData[header] = columnData
      }
    })
    
    // Create preview
    const preview = data.slice(0, 10).map(row => row.slice(0, 10))
    
    const result: ScalarData = {
      id,
      name: file.name,
      content,
      preview,
      headers,
      hasHeaders: config.hasHeaders,
      rowCount: data.length,
      columnCount: headers.length,
      data: processedData,
      columnTypes,
      isValid: true,
      errors: [],
      warnings: [],
      uploadedAt: new Date()
    }
    
    // Run validation
    const validation = validateScalarData(result)
    result.isValid = validation.isValid
    result.errors = validation.errors
    result.warnings = validation.warnings
    
    return result
    
  } catch (error) {
    return {
      id,
      name: file.name,
      content,
      preview: [],
      headers: [],
      hasHeaders: config.hasHeaders,
      rowCount: 0,
      columnCount: 0,
      data: {},
      columnTypes: {},
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      warnings: [],
      uploadedAt: new Date()
    }
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validateSpectralData(data: RawSpectralData): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for empty data
  if (!data.spectra || data.spectra.length === 0) {
    errors.push('No spectral data found')
    return { isValid: false, errors, warnings, suggestions: [] }
  }
  
  // Check wavelength consistency
  if (!data.wavelengths || data.wavelengths.length === 0) {
    errors.push('No wavelength information found')
  } else if (data.wavelengths.length !== data.spectra[0]?.length) {
    errors.push('Wavelength count does not match spectral data columns')
  }
  
  // Check for consistent row lengths
  const firstRowLength = data.spectra[0]?.length || 0
  const inconsistentRows = data.spectra.filter(row => row.length !== firstRowLength)
  if (inconsistentRows.length > 0) {
    errors.push(`${inconsistentRows.length} rows have inconsistent column counts`)
  }
  
  // Check for missing values
  let missingValues = 0
  data.spectra.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (isNaN(value) || value === null || value === undefined) {
        missingValues++
      }
    })
  })
  
  if (missingValues > 0) {
    warnings.push(`Found ${missingValues} missing or invalid values`)
  }
  
  // Check wavelength ordering
  if (data.wavelengths && data.wavelengths.length > 1) {
    const isAscending = data.wavelengths.every((w, i) => i === 0 || w >= data.wavelengths[i - 1])
    const isDescending = data.wavelengths.every((w, i) => i === 0 || w <= data.wavelengths[i - 1])
    
    if (!isAscending && !isDescending) {
      warnings.push('Wavelengths are not in ascending or descending order')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: []
  }
}

export function validateScalarData(data: ScalarData): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for empty data
  if (!data.data || Object.keys(data.data).length === 0) {
    errors.push('No scalar data found')
    return { isValid: false, errors, warnings, suggestions: [] }
  }
  
  // Check for consistent row counts across columns
  const columnNames = Object.keys(data.data)
  const rowCounts = columnNames.map(col => data.data[col].length)
  const uniqueRowCounts = [...new Set(rowCounts)]
  
  if (uniqueRowCounts.length > 1) {
    errors.push('Inconsistent row counts across columns')
  }
  
  // Check for empty columns
  const emptyColumns = columnNames.filter(col => 
    data.data[col].every(val => val === '' || val === null || val === undefined)
  )
  
  if (emptyColumns.length > 0) {
    warnings.push(`Found ${emptyColumns.length} empty columns: ${emptyColumns.join(', ')}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: []
  }
}

export function validateDomain(
  data: RawSpectralData,
  params?: DomainParameters
): DomainValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  
  if (!data.wavelengths || data.wavelengths.length === 0) {
    return {
      isValid: false,
      errors: ['No wavelength data available'],
      warnings: [],
      suggestions: [],
      wavelengthRange: [0, 0],
      samplingRegularity: 'irregular',
      missingValues: 0,
      duplicateWavelengths: []
    }
  }
  
  const wavelengths = data.wavelengths
  const wavelengthRange: [number, number] = [Math.min(...wavelengths), Math.max(...wavelengths)]
  
  // Check for duplicate wavelengths
  const duplicates: number[] = []
  const seen = new Set<number>()
  wavelengths.forEach(w => {
    if (seen.has(w)) {
      duplicates.push(w)
    }
    seen.add(w)
  })
  
  if (duplicates.length > 0) {
    errors.push(`Found ${duplicates.length} duplicate wavelengths`)
  }
  
  // Check sampling regularity
  let samplingRegularity: 'regular' | 'irregular' = 'regular'
  if (wavelengths.length > 2) {
    const steps = wavelengths.slice(1).map((w, i) => w - wavelengths[i])
    const uniqueSteps = [...new Set(steps.map(s => Math.round(s * 1000) / 1000))]
    
    if (uniqueSteps.length > 1) {
      samplingRegularity = 'irregular'
      warnings.push('Irregular wavelength sampling detected')
    }
  }
  
  // Count missing values
  let missingValues = 0
  data.spectra.forEach(row => {
    row.forEach(val => {
      if (isNaN(val) || val === null || val === undefined) {
        missingValues++
      }
    })
  })
  
  // Validate against domain parameters if provided
  if (params) {
    if (wavelengthRange[0] < params.startWavelength) {
      warnings.push(`Data starts at ${wavelengthRange[0]}, but domain starts at ${params.startWavelength}`)
    }
    if (wavelengthRange[1] > params.endWavelength) {
      warnings.push(`Data ends at ${wavelengthRange[1]}, but domain ends at ${params.endWavelength}`)
    }
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
// Utility Functions
// ============================================================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function detectFileType(filename: string): 'spectral' | 'scalar' | 'unknown' {
  const lower = filename.toLowerCase()
  
  if (lower.includes('spectr') || lower.includes('wavelength') || lower.includes('intensity')) {
    return 'spectral'
  }
  
  if (lower.includes('scalar') || lower.includes('metadata') || lower.includes('variable')) {
    return 'scalar'
  }
  
  return 'unknown'
}

export function suggestConfiguration(content: string): Partial<ParseConfig> {
  const sample = content.slice(0, 1000) // First 1000 characters
  
  // Detect separator
  const separators = [',', ';', '\t']
  const separatorCounts = separators.map(sep => 
    (sample.match(new RegExp(`\\${sep}`, 'g')) || []).length
  )
  const mostLikelySeparator = separators[separatorCounts.indexOf(Math.max(...separatorCounts))]
  
  // Detect decimal separator
  const commaCount = (sample.match(/\d,\d/g) || []).length
  const dotCount = (sample.match(/\d\.\d/g) || []).length
  const decimalSeparator = commaCount > dotCount ? ',' : '.'
  
  // Detect headers (simple heuristic)
  const lines = sample.split('\n').filter(line => line.trim())
  const hasHeaders = lines.length > 1 && 
    lines[0].split(mostLikelySeparator).some(col => isNaN(parseFloat(col)))
  
  return {
    columnSeparator: mostLikelySeparator as ',' | ';' | '\t',
    decimalSeparator,
    hasHeaders
  }
}
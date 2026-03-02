/**
 * Utilidades de Parsing y Procesamiento de Datos
 * 
 * Este módulo proporciona utilidades completas para parsear y procesar
 * archivos de datos espectrales en varios formatos. Gestiona:
 * - Parsing de archivos CSV/TXT con delimitadores configurables
 * - Detección y conversión de tipos de datos
 * - Validación de formato de archivo y manejo de errores
 * - Procesamiento de matrices espectrales y datos escalares
 * - Funcionalidad de vista previa y validación de datos
 */

import type { SpectralMatrix, ScalarMatrix } from '@/hooks/useAppState'

export interface ParseOptions {
  decimalSeparator: '.' | ','
  columnSeparator: ',' | ';' | '\t'
  hasHeaders: boolean
}

/**
 * Parsea contenido CSV en una matriz de strings
 */
export function parseCSV(content: string, options: ParseOptions): string[][] {
  const { columnSeparator } = options
  
  // Normalizar terminaciones de línea y dividir en líneas
  const lines = content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(line => line.trim().length > 0)
  
  if (lines.length === 0) {
    throw new Error('File is empty')
  }
  
  // Parse each line
  const rows: string[][] = []
  
  for (const line of lines) {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === columnSeparator && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    cells.push(current.trim())
    rows.push(cells)
  }
  
  return rows
}

/**
 * Normalize decimal separator in a value
 */
function normalizeDecimal(value: string, fromSeparator: '.' | ','): string {
  if (fromSeparator === ',') {
    return value.replace(/,/g, '.')
  }
  return value
}

/**
 * Parse spectral matrix from CSV content
 */
export function parseSpectralMatrix(content: string, options: ParseOptions): SpectralMatrix {
  const rows = parseCSV(content, options)
  
  if (rows.length === 0) {
    throw new Error('No data found in file')
  }
  
  let dataRows = rows
  
  // Skip headers if present
  if (options.hasHeaders) {
    dataRows = rows.slice(1)
  }
  
  if (dataRows.length === 0) {
    throw new Error('No data rows found (only headers)')
  }
  
  const spectralMatrix: SpectralMatrix = []
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const numericRow: number[] = []
    
    for (let j = 0; j < row.length; j++) {
      const cell = row[j]
      
      if (cell === '' || cell === null || cell === undefined) {
        throw new Error(`Empty cell found at row ${i + 1}, column ${j + 1}`)
      }
      
      const normalized = normalizeDecimal(cell, options.decimalSeparator)
      const value = parseFloat(normalized)
      
      if (isNaN(value)) {
        throw new Error(`Invalid numeric value "${cell}" at row ${i + 1}, column ${j + 1}`)
      }
      
      numericRow.push(value)
    }
    
    // Check for consistent column count
    if (i > 0 && numericRow.length !== spectralMatrix[0].length) {
      throw new Error(`Inconsistent column count at row ${i + 1}. Expected ${spectralMatrix[0].length}, got ${numericRow.length}`)
    }
    
    spectralMatrix.push(numericRow)
  }
  
  return spectralMatrix
}

/**
 * Parse scalar matrix from CSV content
 */
export function parseScalarMatrix(content: string, options: ParseOptions): ScalarMatrix {
  const rows = parseCSV(content, options)
  
  if (rows.length === 0) {
    throw new Error('No data found in file')
  }
  
  if (!options.hasHeaders) {
    throw new Error('Scalar data must have headers')
  }
  
  if (rows.length < 2) {
    throw new Error('Scalar data must have at least one data row')
  }
  
  const headers = rows[0]
  const dataRows = rows.slice(1)
  
  const scalarMatrix: ScalarMatrix = []
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const record: Record<string, number | string> = {}
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      const cell = row[j] || ''
      
      // Try to parse as number first
      const normalized = normalizeDecimal(cell, options.decimalSeparator)
      const numValue = parseFloat(normalized)
      
      if (!isNaN(numValue) && isFinite(numValue)) {
        record[header] = numValue
      } else {
        // Keep as string if not a valid number
        record[header] = cell
      }
    }
    
    scalarMatrix.push(record)
  }
  
  return scalarMatrix
}

/**
 * Get file preview (first few rows)
 */
export function getFilePreview(content: string, options: ParseOptions, maxRows: number = 5): string[][] {
  try {
    const rows = parseCSV(content, options)
    return rows.slice(0, maxRows)
  } catch (error) {
    return []
  }
}

/**
 * Validate file content before parsing
 */
export function validateFileContent(content: string): { isValid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { isValid: false, error: 'File is empty' }
  }
  
  if (content.length > 50 * 1024 * 1024) { // 50MB limit
    return { isValid: false, error: 'File is too large (max 50MB)' }
  }
  
  return { isValid: true }
}

/**
 * Auto-detect separator with improved logic
 */
export function detectSeparator(content: string): ',' | ';' | '\t' {
  const lines = content.split(/\r\n|\n/).filter(line => line.trim().length > 0)
  
  if (lines.length === 0) return ','
  
  // Analyze first few lines to get consistent column counts
  const separators: (',' | ';' | '\t')[] = [',', ';', '\t']
  const separatorScores: { separator: string; score: number; avgColumns: number }[] = []
  
  for (const sep of separators) {
    let totalColumns = 0
    let consistentRows = 0
    let maxColumns = 0
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const columns = lines[i].split(sep).length
      totalColumns += columns
      maxColumns = Math.max(maxColumns, columns)
      
      // Check if this row has a reasonable number of columns (not too few)
      if (columns >= 2) {
        consistentRows++
      }
    }
    
    const avgColumns = totalColumns / Math.min(5, lines.length)
    const consistencyScore = consistentRows / Math.min(5, lines.length)
    
    // Score based on consistency and reasonable column count
    const score = consistencyScore * avgColumns
    
    separatorScores.push({ separator: sep, score, avgColumns })
  }
  
  // Choose separator with highest score and most consistent column count
  const bestSeparator = separatorScores.reduce((best, current) => {
    if (current.score > best.score || 
        (current.score === best.score && current.avgColumns > best.avgColumns)) {
      return current
    }
    return best
  })
  
  return bestSeparator.separator as ',' | ';' | '\t'
}

/**
 * Auto-detect decimal separator with improved logic
 */
export function detectDecimalSeparator(content: string): '.' | ',' {
  const sample = content.slice(0, 2000) // Increased sample size
  
  // Look for patterns like "1,5" vs "1.5" but be more specific
  const commaDecimalPattern = /\b\d+,\d+\b/g  // Word boundaries to avoid false positives
  const dotDecimalPattern = /\b\d+\.\d+\b/g
  
  const commaMatches = (sample.match(commaDecimalPattern) || []).length
  const dotMatches = (sample.match(dotDecimalPattern) || []).length
  
  // Also check for scientific notation patterns
  const scientificComma = /\d+,\d+e[+-]?\d+/gi
  const scientificDot = /\d+\.\d+e[+-]?\d+/gi
  
  const scientificCommaMatches = (sample.match(scientificComma) || []).length
  const scientificDotMatches = (sample.match(scientificDot) || []).length
  
  const totalComma = commaMatches + scientificCommaMatches
  const totalDot = dotMatches + scientificDotMatches
  
  return totalComma > totalDot ? ',' : '.'
}

/**
 * Auto-detect if file has headers with improved logic
 */
export function detectHeaders(content: string, columnSeparator: string): boolean {
  const lines = content.split(/\r\n|\n/).filter(line => line.trim().length > 0)
  
  if (lines.length < 2) {
    return false
  }
  
  // Analyze first few rows to make a better decision
  const rowsToAnalyze = Math.min(3, lines.length)
  const rows = lines.slice(0, rowsToAnalyze).map(line => line.split(columnSeparator))
  
  let numericRowCount = 0
  let nonNumericRowCount = 0
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let numericCells = 0
    let totalCells = 0
    
    for (const cell of row) {
      const trimmed = cell.trim()
      if (trimmed.length > 0) {
        totalCells++
        const num = parseFloat(trimmed)
        if (!isNaN(num) && isFinite(num)) {
          numericCells++
        }
      }
    }
    
    // If more than 80% of cells are numeric, consider this a data row
    if (totalCells > 0 && numericCells / totalCells > 0.8) {
      numericRowCount++
    } else {
      nonNumericRowCount++
    }
  }
  
  // If first row is non-numeric and subsequent rows are numeric, likely has headers
  const firstRowNumeric = rows[0].every(cell => {
    const trimmed = cell.trim()
    return trimmed.length === 0 || (!isNaN(parseFloat(trimmed)) && isFinite(parseFloat(trimmed)))
  })
  
  return !firstRowNumeric && numericRowCount > nonNumericRowCount
}

/**
 * Validate parsing options and return warnings
 */
export function validateParsingOptions(
  content: string, 
  options: ParseOptions
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = []
  
  try {
    const rows = parseCSV(content, options)
    
    if (rows.length === 0) {
      return { isValid: false, warnings: ['No data found with current settings'] }
    }
    
    // Check for consistent row lengths
    const firstRowLength = rows[0].length
    const inconsistentRows = rows.filter(row => row.length !== firstRowLength)
    
    if (inconsistentRows.length > 0) {
      warnings.push(`${inconsistentRows.length} rows have inconsistent column counts`)
    }
    
    // Check for all NaN values (might indicate wrong decimal separator)
    if (options.hasHeaders && rows.length > 1) {
      const dataRows = rows.slice(1)
      const allNaNCount = dataRows.filter(row => 
        row.every(cell => {
          const normalized = normalizeDecimal(cell, options.decimalSeparator)
          return isNaN(parseFloat(normalized))
        })
      ).length
      
      if (allNaNCount > dataRows.length * 0.5) {
        warnings.push('Many rows contain only non-numeric values - check decimal separator')
      }
    }
    
    return { isValid: true, warnings }
    
  } catch (error) {
    return { 
      isValid: false, 
      warnings: [`Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
    }
  }
}
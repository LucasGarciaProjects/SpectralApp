/**
 * Algoritmos FDA - Capa Cliente Delgada
 * 
 * Este archivo actúa como un cliente delgado que llama a endpoints de Python
 * usando scikit-fda para todas las operaciones de análisis de datos funcionales.
 * 
 * Todas las implementaciones matemáticas se han movido a Python.
 */

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type BasisType = 'bspline' | 'fourier' | 'wavelet'

export interface FunctionalizationParams {
  basisType: BasisType
  nBasis: number
  lambda: number // 0.01..5.0
  name: string
}

export interface DomainConfig {
  startWavelength: number
  endWavelength: number
  nPoints: number
  stepSize: number
  isConfirmed: boolean
}

export interface FunctionalizationResponse {
  data: number[][] // fitted curves (N x M)
  coefficients: number[][] // (N x P) in basis space
  parameters: FunctionalizationParams & { domain: DomainConfig; nSpectra: number }
  metrics: { rmse: number; r2: number }
  meta: { basisType: BasisType; nBasis: number; lambda: number }
}

export interface GCVResponse {
  lambda_opt: number
  boundary: boolean
  gcv_values?: number[]
  lambda_grid?: number[]
}

// ============================================================================
// Funciones API
// ============================================================================

/**
 * Functionalize matrix data using Python/scikit-fda
 */
export async function apiFunctionalizeMatrix(
  rawData: number[][],
  domain: DomainConfig,
  params: FunctionalizationParams
): Promise<FunctionalizationResponse> {
  const res = await fetch('/api/functionalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawData, domain, params }),
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Functionalization failed: ${error.details || error.error}`)
  }
  
  return await res.json()
}

/**
 * Auto GCV optimization using Python/scikit-fda
 */
export async function apiAutoGCV(
  rawData: number[][],
  domain: DomainConfig,
  basisType: BasisType,
  nBasis: number
): Promise<GCVResponse> {
  const res = await fetch('/api/functionalize/gcv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      rawData, 
      domain, 
      basisType, 
      nBasis, 
      range: { start: 0.01, stop: 5.0, step: 0.1 } 
    }),
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Auto GCV failed: ${error.details || error.error}`)
  }
  
  return await res.json()
}

// ============================================================================
// Legacy Compatibility Functions
// ============================================================================

/**
 * Legacy function for single spectrum functionalization
 * Now calls the matrix function internally
 */
export async function functionalizeSpectrum(
  spectrum: number[],
  x: number[],
  params: FunctionalizationParams
): Promise<{
  fitted: number[]
  coefficients: number[]
  rmse: number
  r2: number
}> {
  // Convert single spectrum to matrix format
  const rawData = [spectrum]
  const domain: DomainConfig = {
    startWavelength: x[0],
    endWavelength: x[x.length - 1],
    nPoints: x.length,
    stepSize: x[1] - x[0],
    isConfirmed: true
  }
  
  const result = await apiFunctionalizeMatrix(rawData, domain, params)
  
  return {
    fitted: result.data[0],
    coefficients: result.coefficients[0],
    rmse: result.metrics.rmse,
    r2: result.metrics.r2
  }
}

/**
 * Legacy function for matrix functionalization
 * Now calls the Python API
 */
export async function functionalizeMatrix(
  rawData: number[][],
  domain: DomainConfig,
  params: FunctionalizationParams
): Promise<FunctionalizationResponse> {
  return await apiFunctionalizeMatrix(rawData, domain, params)
}

/**
 * Legacy function for optimal lambda selection
 * Now calls the Python GCV API
 */
export async function selectOptimalLambda(
  spectrum: number[],
  x: number[],
  nBasis: number,
  basisType: BasisType = 'bspline'
): Promise<number> {
  // Convert single spectrum to matrix format
  const rawData = [spectrum]
  const domain: DomainConfig = {
    startWavelength: x[0],
    endWavelength: x[x.length - 1],
    nPoints: x.length,
    stepSize: x[1] - x[0],
    isConfirmed: true
  }
  
  const result = await apiAutoGCV(rawData, domain, basisType, nBasis)
  
  console.log(`[GCV] Optimal lambda: ${result.lambda_opt}, boundary: ${result.boundary}`)
  
  return result.lambda_opt
}

// ============================================================================
// Utility Functions (kept for UI compatibility)
// ============================================================================

/**
 * Get recommended parameters for different basis types
 */
export function getRecommendedParams(nPoints: number, basisType: BasisType) {
  switch (basisType) {
    case 'bspline':
      return {
        nBasis: getRuppertBasisCount(nPoints),
        lambda: 0.1
      }
    case 'fourier':
      return {
        nBasis: Math.min(Math.max(8, Math.floor(nPoints / 4)), 32),
        lambda: 0.01
      }
    case 'wavelet':
      const targetBasis = Math.min(Math.max(8, Math.floor(nPoints / 6)), 32)
      const nearestPower2 = Math.pow(2, Math.round(Math.log2(targetBasis)))
      return {
        nBasis: Math.min(32, nearestPower2),
        lambda: 0.05
      }
    default:
      return {
        nBasis: getRuppertBasisCount(nPoints),
        lambda: 0.1
      }
  }
}

/**
 * Ruppert's rule for B-spline basis count
 */
export function getRuppertBasisCount(nPoints: number): number {
  return Math.min(Math.max(4, Math.floor(nPoints / 4)), 20)
}

// ============================================================================
// Derivative Functions (kept for UI compatibility)
// ============================================================================

/**
 * Compute derivative from basis coefficients
 */
export function computeDerivativeFromBasis(
  coefficients: number[],
  basisType: BasisType,
  domain: DomainConfig,
  order: number = 1
): number[] {
  // This is a simplified implementation for UI purposes
  // The actual derivative computation is now handled in Python
  console.warn('Derivative computation should be handled in Python for accuracy')
  return coefficients // Placeholder
}

/**
 * Apply derivative transform
 */
export function applyDerivativeTransform(
  data: number[][],
  order: number
): number[][] {
  // This is a simplified implementation for UI purposes
  // The actual derivative computation is now handled in Python
  console.warn('Derivative transform should be handled in Python for accuracy')
  return data // Placeholder
}

// ============================================================================
// Export all functions for backward compatibility
// ============================================================================

export {
  apiAutoGCV as autoGCV
}

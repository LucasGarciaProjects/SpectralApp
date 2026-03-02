/**
 * Algoritmo de Análisis de Componentes Principales Funcional (FPCA)
 * 
 * Este archivo contiene la implementación matemática principal de FPCA:
 * - Estimación basada en matriz de covarianza
 * - Descomposición espectral (autovalores/autovectores)
 * - Rotación Varimax para mejorar la interpretabilidad
 * - Funciones auxiliares de álgebra lineal
 */

export type FPCAIntermediate = {
  scores: number[][];           // n × k (proyecciones de curvas sobre componentes)
  components: number[][];       // k × p (autofunciones discretizadas / loadings)
  explainedVariance: number[];  // porcentaje de varianza explicada por componente
  cumulativeVariance: number[]; // varianza acumulada
  centerFunc?: number[];        // media funcional
  meta?: { rotated?: string };  // metadata adicional
};

// ============================================================================
// Funciones Auxiliares Privadas
// ============================================================================

// Centrado por columnas
function _centerMatrix(X: number[][]): { centered: number[][]; means: number[] } {
  const n = X.length;
  if (!n) return { centered: [], means: [] };

  const p = X[0].length;
  const means = new Array(p).fill(0);

  for (let j = 0; j < p; j++) {
    for (let i = 0; i < n; i++) {
      means[j] += X[i][j];
    }
    means[j] /= n;
  }

  const centered = Array.from({ length: n }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      centered[i][j] = X[i][j] - means[j];
    }
  }

  return { centered, means };
}

// Matriz de covarianza: (1/(n-1)) * X^T X
function _covarianceMatrix(X: number[][]): number[][] {
  const n = X.length;
  if (!n) return [];

  const p = X[0].length;
  const cov = Array.from({ length: p }, () => new Array(p).fill(0));

  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      const covValue = sum / Math.max(n - 1, 1);
      cov[i][j] = covValue;
      if (i !== j) cov[j][i] = covValue;
    }
  }
  return cov;
}

// Descomposición espectral usando iteración de potencias
function _eig(matrix: number[][], nComponents: number): { values: number[]; vectors: number[][] } {
  const p = matrix.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];
  let remaining = matrix.map(row => [...row]);

  for (let i = 0; i < Math.min(nComponents, p); i++) {
    const { eigenvector, eigenvalue } = _powerIteration(remaining);
    if (eigenvalue < 1e-10) break;
    eigenvalues.push(eigenvalue);
    eigenvectors.push(eigenvector);
    _deflateMatrix(remaining, eigenvector, eigenvalue);
  }

  return { values: eigenvalues, vectors: eigenvectors };
}

// Iteración de potencias → mayor autovalor/autovector
function _powerIteration(matrix: number[][], maxIter = 1000, tol = 1e-10) {
  const n = matrix.length;
  let v = Array(n).fill(0).map(() => Math.random() - 0.5);
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  v = v.map(x => x / norm);

  let eigenvalue = 0, prev = 0;
  for (let it = 0; it < maxIter; it++) {
    const newV = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        newV[i] += matrix[i][j] * v[j];
      }
    }
    eigenvalue = v.reduce((s, val, i) => s + val * newV[i], 0);
    norm = Math.sqrt(newV.reduce((s, x) => s + x * x, 0));
    if (norm < 1e-15) break;
    v = newV.map(x => x / norm);
    if (Math.abs(eigenvalue - prev) < tol) break;
    prev = eigenvalue;
  }
  return { eigenvector: v, eigenvalue: Math.max(0, eigenvalue) };
}

// Deflación → resta la contribución del autovalor encontrado
function _deflateMatrix(matrix: number[][], eigenvector: number[], eigenvalue: number) {
  const n = matrix.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] -= eigenvalue * eigenvector[i] * eigenvector[j];
    }
  }
}

// Normalización de autovectores
function _normalize(vecs: number[][]): number[][] {
  return vecs.map(v => {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return norm > 0 ? v.map(x => x / norm) : v;
  });
}

// Multiplicación de matrices
function _matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length, p = A[0]?.length ?? 0;
  const p2 = B.length, k = B[0]?.length ?? 0;
  if (p !== p2) throw new Error("Dimension mismatch in matMul");

  const C = Array.from({ length: n }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < k; t++) {
      let s = 0;
      for (let j = 0; j < p; j++) s += A[i][j] * B[j][t];
      C[i][t] = s;
    }
  }
  return C;
}

// Transpuesta de matriz
function _transpose(A: number[][]): number[][] {
  const n = A.length, p = A[0]?.length ?? 0;
  return Array.from({ length: p }, (_, j) => A.map(row => row[j]));
}

// Rotación Varimax
function _varimax(loadings: number[][], maxIter = 200, tol = 1e-6) {
  const p = loadings.length, k = loadings[0]?.length ?? 0;
  if (k < 2) return { loadings, R: Array.from({ length: k }, (_, i) => {
    const r = new Array(k).fill(0); r[i] = 1; return r;
  }) };

  let L = loadings.map(r => [...r]);
  let R = Array.from({ length: k }, (_, i) => {
    const r = new Array(k).fill(0); r[i] = 1; return r;
  });

  let prev = -Infinity;
  for (let it = 0; it < maxIter; it++) {
    let improved = false;
    for (let a = 0; a < k - 1; a++) {
      for (let b = a + 1; b < k; b++) {
        let u2 = 0, v2 = 0;
        for (let i = 0; i < p; i++) {
          const xa = L[i][a], xb = L[i][b];
          u2 += xa * xa - xb * xb;
          v2 += 2 * xa * xb;
        }
        const ang = 0.25 * Math.atan2(2 * v2, u2);
        if (Math.abs(ang) > 1e-12) {
          const c = Math.cos(ang), s = Math.sin(ang);
          for (let i = 0; i < p; i++) {
            const xa = L[i][a], xb = L[i][b];
            L[i][a] = c * xa + s * xb;
            L[i][b] = -s * xa + c * xb;
          }
          for (let i = 0; i < k; i++) {
            const ra = R[i][a], rb = R[i][b];
            R[i][a] = c * ra + s * rb;
            R[i][b] = -s * ra + c * rb;
          }
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return { loadings: L, R };
}

// ============================================================================
// Funciones Públicas
// ============================================================================

// FPCA clásico a partir de matriz de covarianza
export function fpcaFromCovariance(X_fd: number[][], nComponents: number, center = true): FPCAIntermediate {
  const n = X_fd.length;
  if (!n) return { scores: [], components: [], explainedVariance: [], cumulativeVariance: [], centerFunc: [], meta: { rotated: "none" } };

  const p = X_fd[0].length;
  let X_centered: number[][], mean: number[] = [];
  if (center) {
    const { centered, means } = _centerMatrix(X_fd);
    X_centered = centered;
    mean = means;
  } else {
    X_centered = X_fd.map(r => [...r]);
  }

  const cov = _covarianceMatrix(X_centered);
  const { values, vectors } = _eig(cov, nComponents);
  const components = _normalize(vectors);
  const scores = _matMul(X_centered, _transpose(components));

  const totalVar = values.reduce((s, v) => s + v, 0);
  const explained = values.map(v => (v / totalVar) * 100);
  const cumulative = explained.map((v, i) => explained.slice(0, i + 1).reduce((s, x) => s + x, 0));

  return { scores, components, explainedVariance: explained, cumulativeVariance: cumulative, centerFunc: mean, meta: { rotated: "none" } };
}

// Aplicar rotación Varimax
export function applyVarimaxToFpca(base: FPCAIntermediate): FPCAIntermediate {
  const k = base.components.length, p = base.components[0]?.length ?? 0;
  if (!k || !p) return base;

  const { loadings: rotatedLoadings, R } = _varimax(_transpose(base.components));
  const rotatedComponents = _transpose(rotatedLoadings);
  const Rt = _transpose(R);
  const rotatedScores = _matMul(base.scores, Rt);

  const n = rotatedScores.length;
  const variances = Array(k).fill(0);
  for (let j = 0; j < k; j++) {
    const vals = rotatedScores.map(r => r[j]);
    const mean = vals.reduce((s, x) => s + x, 0) / n;
    variances[j] = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(n - 1, 1);
  }
  const totalVar = variances.reduce((s, v) => s + v, 0);
  const explained = variances.map(v => (v / totalVar) * 100);
  const cumulative = explained.map((v, i) => explained.slice(0, i + 1).reduce((s, x) => s + x, 0));

  return { scores: rotatedScores, components: rotatedComponents, explainedVariance: explained, cumulativeVariance: cumulative, centerFunc: base.centerFunc, meta: { rotated: "varimax" } };
}

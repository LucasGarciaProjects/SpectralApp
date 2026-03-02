import { FunctionalMatrix, ScalarVector, SupervisedResult, FPCAParamsSchema } from "../types";
import { getTechnique } from "../registry";

// Matrix operations for linear regression
function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < B.length; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  
  // Gaussian elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];
    
    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      b[k] -= factor * b[i];
    }
  }
  
  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = b[i];
    for (let j = i + 1; j < n; j++) {
      x[i] -= A[i][j] * x[j];
    }
    x[i] /= A[i][i];
  }
  
  return x;
}

function calculateStandardErrors(X: number[][], residuals: number[]): number[] {
  const n = X.length;
  const p = X[0].length;
  const df = n - p;
  
  // Calculate residual sum of squares
  const rss = residuals.reduce((sum, r) => sum + r * r, 0);
  const mse = rss / df;
  
  // Calculate (X'X)^-1
  const Xt = transpose(X);
  const XtX = matrixMultiply(Xt, X);
  
  // Invert XtX (simplified for small matrices)
  const invXtX = invertMatrix(XtX);
  
  // Standard errors = sqrt(mse * diag((X'X)^-1))
  const stderr = new Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    stderr[i] = Math.sqrt(mse * invXtX[i][i]);
  }
  
  return stderr;
}

function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const identity = Array.from({ length: n }, (_, i) => 
    Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
  );
  
  // Create augmented matrix
  const augmented = matrix.map((row, i) => [...row, ...identity[i]]);
  
  // Gaussian elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    // Make diagonal element 1
    const pivot = augmented[i][i];
    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot;
    }
    
    // Make other elements in column 0
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i];
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
  }
  
  // Extract inverse matrix
  return augmented.map(row => row.slice(n));
}

function calculateTValues(coefficients: number[], stderr: number[]): number[] {
  return coefficients.map((coef, i) => coef / stderr[i]);
}

function calculatePValues(tvalues: number[], df: number): number[] {
  // Simplified t-test p-value calculation
  return tvalues.map(t => {
    const absT = Math.abs(t);
    // Approximate p-value using normal approximation for large df
    if (df > 30) {
      return 2 * (1 - normalCDF(absT));
    }
    // For smaller df, use approximation
    return 2 * (1 - normalCDF(absT));
  });
}

function normalCDF(x: number): number {
  // Approximation of standard normal CDF
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function erf(x: number): number {
  // Approximation of error function
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

function calculateR2(y: number[], fitted: number[]): { r2: number; adjR2: number } {
  const n = y.length;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;
  
  const ssTot = y.reduce((sum, val) => sum + (val - yMean) ** 2, 0);
  const ssRes = y.reduce((sum, val, i) => sum + (val - fitted[i]) ** 2, 0);
  
  const r2 = 1 - (ssRes / ssTot);
  
  // Adjusted R² (assuming p predictors)
  const p = fitted.length > 0 ? 1 : 0; // Will be updated with actual number of predictors
  const adjR2 = 1 - ((1 - r2) * (n - 1)) / (n - p - 1);
  
  return { r2, adjR2 };
}

export async function runFPCR(
  X_fd: FunctionalMatrix, 
  y: ScalarVector,
  params: unknown
): Promise<SupervisedResult> {
  // Parse parameters
  const schema = FPCAParamsSchema;
  const p = schema.parse(params);
  
  // 1. Run FPCA to get scores
  const fpca = getTechnique("fpca");
  const fpcaResult = await fpca.run(X_fd, null, {
    nComponents: p.nComponents,
    center: p.center,
    scaleScores: p.scaleScores,
    varimax: false
  });
  
  // 2. Prepare design matrix X (n × p) with intercept
  const n = y.length;
  const X = fpcaResult.scores.map((row: number[]) => [1, ...row.slice(0, p.nComponents)]); // Add intercept column
  
  // 3. Fit linear regression: Y = Xβ + ε
  const Xt = transpose(X);
  const XtX = matrixMultiply(Xt, X);
  const Xty = Xt.map((row: number[]) => row.reduce((sum: number, x: number, i: number) => sum + x * y[i], 0));
  
  // Simple linear regression (no regularization)
  
  const coefficients = solveLinearSystem(XtX.map((row: number[]) => [...row]), [...Xty]);
  const intercept = coefficients[0];
  const betas = coefficients.slice(1);
  
  // 4. Calculate fitted values and residuals
  const fitted = X.map((row: number[]) => row.reduce((sum: number, x: number, i: number) => sum + x * coefficients[i], 0));
  const residuals = y.map((yi, i) => yi - fitted[i]);
  
  // 5. Calculate standard errors, t-values, p-values
  const stderr = calculateStandardErrors(X, residuals);
  const tvalues = calculateTValues(coefficients, stderr);
  const df = n - coefficients.length;
  const pvalues = calculatePValues(tvalues, df);
  
  // 6. Calculate R² and adjusted R²
  const { r2, adjR2 } = calculateR2(y, fitted);
  
  // 7. Calculate functional parameter β(t)
  const functionalParameter = {
    beta: new Array(X_fd[0].length).fill(0),
    lower: new Array(X_fd[0].length).fill(0),
    upper: new Array(X_fd[0].length).fill(0),
    domain: Array.from({ length: X_fd[0].length }, (_, i) => i + 1)
  };
  
  // β(t) = Σ βi * φi(t) where φi are the FPC loadings
  for (let t = 0; t < X_fd[0].length; t++) {
    let beta_t = 0;
    let var_beta_t = 0;
    
    for (let i = 0; i < p.nComponents; i++) {
      if (fpcaResult.components && fpcaResult.components[i]) {
        beta_t += betas[i] * fpcaResult.components[i][t];
        // Approximate variance (simplified)
        var_beta_t += (betas[i] * fpcaResult.components[i][t]) ** 2 * (stderr[i + 1] / betas[i]) ** 2;
      }
    }
    
    functionalParameter.beta[t] = beta_t;
    const se_beta_t = Math.sqrt(var_beta_t);
    const t_critical = 1.96; // Approximate 95% CI
    functionalParameter.lower[t] = beta_t - t_critical * se_beta_t;
    functionalParameter.upper[t] = beta_t + t_critical * se_beta_t;
  }
  
  // 8. Create summary
  const summary = `FPCR Model Summary:
R² = ${r2.toFixed(4)}
Adjusted R² = ${adjR2.toFixed(4)}
Number of FPCs: ${p.nComponents}
Sample size: ${n}`;
  
  const rmse = Math.sqrt(residuals.reduce((s, v) => s + v * v, 0) / n);

  return {
    kind: "supervised:regression",
    params: p,
    intercept,
    coefficients: betas,
    stderr: stderr || [],
    tvalues: tvalues || [],
    pvalues: pvalues || [],
    featurizer: fpcaResult,
    predictions: fitted,
    residuals: residuals,
    metrics: { rmse, r2, adjR2 },
    extras: {
      summary,
      functionalParameter
    }
  };
}
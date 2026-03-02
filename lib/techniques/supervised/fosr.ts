import { FunctionalMatrix, ScalarVector, SupervisedResult, FPCAParamsSchema } from "../types";
import { getTechnique } from "../registry";

/* ---------- Matrix operations ---------- */
function transpose(M: number[][]): number[][] {
  return M[0].map((_, j) => M.map(r => r[j]));
}

function matmul(A: number[][], B: number[][]): number[][] {
  const n = A.length, k = A[0].length, m = B[0].length;
  const out = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i=0;i<n;i++) for (let j=0;j<m;j++) {
    let s = 0;
    for (let t=0;t<k;t++) s += A[i][t]*B[t][j];
    out[i][j] = s;
  }
  return out;
}

function solve(Ain: number[][], bIn: number[]): number[] {
  const A = Ain.map(r => [...r]);
  const b = [...bIn];
  const n = A.length;

  for (let i=0;i<n;i++) {
    let p = i;
    for (let r=i+1;r<n;r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < 1e-15) throw new Error("Singular system");
    if (p !== i) { [A[i],A[p]] = [A[p],A[i]]; [b[i],b[p]] = [b[p],b[i]]; }

    const piv = A[i][i];
    for (let r=i+1;r<n;r++) {
      const f = A[r][i]/piv;
      for (let c=i;c<n;c++) A[r][c] -= f*A[i][c];
      b[r] -= f*b[i];
    }
  }
  const x = Array(n).fill(0);
  for (let i=n-1;i>=0;i--) {
    let s = b[i];
    for (let c=i+1;c<n;c++) s -= A[i][c]*x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

function invert(A: number[][]): number[][] {
  const n = A.length;
  const I = Array.from({length:n},(_,i)=> Array.from({length:n},(_,j)=> i===j?1:0));
  const aug = A.map((r,i)=> [...r, ...I[i]]);
  for (let i=0;i<n;i++) {
    let p = i;
    for (let r=i+1;r<n;r++) if (Math.abs(aug[r][i])>Math.abs(aug[p][i])) p=r;
    if (Math.abs(aug[p][i]) < 1e-15) throw new Error("Singular matrix");
    if (p!==i) [aug[i],aug[p]] = [aug[p],aug[i]];
    const piv = aug[i][i];
    for (let c=0;c<2*n;c++) aug[i][c] /= piv;
    for (let r=0;r<n;r++) if (r!==i) {
      const f = aug[r][i];
      for (let c=0;c<2*n;c++) aug[r][c] -= f*aug[i][c];
    }
  }
  return aug.map(r => r.slice(n));
}

function normalCDF(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x<0?-1:1;
  x=Math.abs(x);
  const t = 1/(1+p*x);
  const y = 1-((((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
  return 0.5*(1+sign*y);
}

export async function runFOSR(
  X_fd: FunctionalMatrix,
  y: ScalarVector,
  params: unknown
): Promise<SupervisedResult> {
  const p = FPCAParamsSchema.parse(params);

  // For FoSR, we have functional predictors (X_fd) and scalar response (y)
  // We regress the scalar response on FPCA scores from functional predictors
  
  // Run FPCA on functional predictors
  const fpca = getTechnique("fpca");
  const fpcaResult = await fpca.run(X_fd, null, {
    nComponents: p.nComponents,
    center: p.center,
    scaleScores: p.scaleScores,
    varimax: false
  });

  const n = y.length;
  const L = X_fd[0].length; // Number of time points
  
  // Prepare design matrix: [1, FPC1, FPC2, ..., FPCk]
  const X = fpcaResult.scores.map((row: number[]) => [1, ...row.slice(0, p.nComponents)]);
  const Xt = transpose(X);
  const XtX = matmul(Xt, X);
  const Xty = matmul(Xt, y.map(yi => [yi])).map(row => row[0]);

  // Solve normal equations: (X'X)β = X'y
  let beta: number[];
  let covMatrix: number[][];
  try {
    beta = solve(XtX, Xty);
    covMatrix = invert(XtX);
  } catch {
    // Add regularization if singular
    const XtX_reg = XtX.map(row => [...row]);
    for (let i = 0; i < XtX_reg.length; i++) {
      XtX_reg[i][i] += 1e-6;
    }
    beta = solve(XtX_reg, Xty);
    covMatrix = invert(XtX_reg);
  }

  const intercept = beta[0];
  const coefficients = beta.slice(1);

  // Calculate fitted values and residuals
  const fitted = X.map((row: number[]) => row.reduce((s, x, i) => s + x * beta[i], 0));
  const residuals = y.map((yi, i) => yi - fitted[i]);

  // Calculate standard errors, t-values, and p-values
  const mse = residuals.reduce((s, r) => s + r * r, 0) / (n - p.nComponents - 1);
  const stderr = covMatrix.map((row, i) => Math.sqrt(Math.max(0, row[i] * mse)));
  const tvalues = beta.map((b, i) => b / (stderr[i] || Infinity));
  const pvalues = tvalues.map(t => 2 * (1 - normalCDF(Math.abs(t))));

  // Calculate R² and adjusted R²
  const yMean = y.reduce((s, yi) => s + yi, 0) / n;
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - p.nComponents - 1);
  const rmse = Math.sqrt(ssRes / n);

  // Calculate functional parameter β(t) - effect of functional predictor on scalar response
  const functionalParameter = {
    beta: Array(L).fill(0),
    lower: Array(L).fill(0),
    upper: Array(L).fill(0),
    domain: Array.from({length: L}, (_, i) => i + 1),
  };

  for (let t = 0; t < L; t++) {
    let bt = 0;
    let varBt = 0;
    for (let i = 0; i < p.nComponents; i++) {
      const comp_it = fpcaResult.components?.[i]?.[t] ?? 0;
      bt += coefficients[i] * comp_it;
      const se_i = stderr[i + 1] ?? 0;
      varBt += (se_i * se_i) * (comp_it * comp_it);
    }
    functionalParameter.beta[t] = bt;
    const seBt = Math.sqrt(Math.max(0, varBt));
    const z = 1.96;
    functionalParameter.lower[t] = bt - z * seBt;
    functionalParameter.upper[t] = bt + z * seBt;
  }

  const summary = `FOSR Model Summary:
R² = ${r2.toFixed(4)}
Adjusted R² = ${adjR2.toFixed(4)}
RMSE = ${rmse.toFixed(4)}
Number of FPCs: ${p.nComponents}
Sample size: ${n}`;

  return {
    kind: "supervised:regression",
    params: p,
    intercept,
    coefficients,
    stderr: stderr.slice(1), // Remove intercept stderr
    tvalues: tvalues.slice(1), // Remove intercept t-value
    pvalues: pvalues.slice(1), // Remove intercept p-value
    featurizer: fpcaResult,
    predictions: fitted,
    residuals,
    metrics: {
      rmse,
      r2,
      adjR2
    },
    extras: {
      summary,
      functionalParameter
    }
  };
}
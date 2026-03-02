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
  const sign = x<0?-1:1; x=Math.abs(x);
  const t = 1/(1+p*x);
  const y = 1-((((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
  return 0.5*(1+sign*y);
}

export async function runFOFR(
  X_fd: FunctionalMatrix,
  y: ScalarVector | FunctionalMatrix,
  params: unknown
): Promise<SupervisedResult> {
  const p = FPCAParamsSchema.parse(params);

  // For FoFR, we need both functional predictor and functional response
  // Check if y is already a functional response (array of arrays)
  let Y_fd: FunctionalMatrix;
  const n = X_fd.length;
  const L = X_fd[0].length; // Number of time points
  
  if (Array.isArray(y[0])) {
    // y is already a functional response
    Y_fd = y as FunctionalMatrix;
  } else {
    // y is scalar, create artificial functional response for backwards compatibility
    Y_fd = [];
    for (let i = 0; i < n; i++) {
      const responseFunction = Array(L).fill(0).map((_, t) => (y as ScalarVector)[i] * Math.sin(2 * Math.PI * t / L));
      Y_fd.push(responseFunction);
    }
  }
  
  // Run FPCA on functional predictors
  const fpca = getTechnique("fpca");
  const fpcaResult = await fpca.run(X_fd, null, {
    nComponents: p.nComponents,
    center: p.center,
    scaleScores: p.scaleScores,
    varimax: false
  });

  // Run FPCA on functional response
  const fpcaResponse = await fpca.run(Y_fd, null, {
    nComponents: p.nComponents,
    center: p.center,
    scaleScores: p.scaleScores,
    varimax: false
  });

  // For FoFR, we regress the response FPC scores on the predictor FPC scores
  const X_scores = fpcaResult.scores.map((row: number[]) => [1, ...row.slice(0, p.nComponents)]);
  const Y_scores = fpcaResponse.scores.map((row: number[]) => row.slice(0, p.nComponents));

  const Xt = transpose(X_scores);
  const XtX = matmul(Xt, X_scores);

  // Solve for each response component
  const functionalCoefficients: number[][] = [];
  const functionalStderr: number[][] = [];
  const fittedFunctions: number[][] = [];
  const residualFunctions: number[][] = [];

  for (let j = 0; j < p.nComponents; j++) {
    const yj = Y_scores.map((row: number[]) => row[j]);
    const Xty = matmul(Xt, yj.map((yi: number) => [yi])).map(row => row[0]);

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

    // Calculate fitted values and residuals for this response component
    const fitted = X_scores.map((row: number[]) => row.reduce((s, x, i) => s + x * beta[i], 0));
    const residuals = yj.map((yi: number, i: number) => yi - fitted[i]);

    // Calculate standard errors
    const mse = residuals.reduce((s: number, r: number) => s + r * r, 0) / (n - p.nComponents - 1);
    const stderr = covMatrix.map((row, i) => Math.sqrt(Math.max(0, row[i] * mse)));

    functionalCoefficients.push(beta);
    functionalStderr.push(stderr);
    fittedFunctions.push(fitted);
    residualFunctions.push(residuals);
  }

  // Reconstruct fitted functional responses
  const fittedFunctionalResponses: FunctionalMatrix = [];
  for (let i = 0; i < n; i++) {
    const fittedResponse = Array(L).fill(0);
    for (let t = 0; t < L; t++) {
      for (let j = 0; j < p.nComponents; j++) {
        const comp_jt = fpcaResponse.components?.[j]?.[t] ?? 0;
        fittedResponse[t] += fittedFunctions[j][i] * comp_jt;
      }
    }
    fittedFunctionalResponses.push(fittedResponse);
  }

  // Calculate overall metrics
  const allResiduals = residualFunctions.flat();
  const allObserved = Y_fd.flat();
  const allFitted = fittedFunctionalResponses.flat();
  
  const ssRes = allResiduals.reduce((s: number, r: number) => s + r * r, 0);
  const ssTot = allObserved.reduce((s: number, o: number) => s + o * o, 0);
  const r2 = 1 - ssRes / ssTot;
  const adjR2 = 1 - (1 - r2) * (n * L - 1) / (n * L - p.nComponents - 1);
  const rmse = Math.sqrt(ssRes / (n * L));

  // Calculate functional parameter β(t) - this represents the effect of the functional predictor
  // on the functional response at each time point
  const functionalParameter = {
    beta: Array(L).fill(0),
    lower: Array(L).fill(0),
    upper: Array(L).fill(0),
    domain: Array.from({length: L}, (_, i) => i + 1),
  };

  for (let t = 0; t < L; t++) {
    let bt = 0;
    let varBt = 0;
    for (let j = 0; j < p.nComponents; j++) {
      const comp_jt = fpcaResponse.components?.[j]?.[t] ?? 0;
      const coef_j = functionalCoefficients[j][1] || 0; // Coefficient of first predictor FPC
      bt += coef_j * comp_jt;
      const se_j = functionalStderr[j][1] || 0;
      varBt += (se_j * se_j) * (comp_jt * comp_jt);
    }
    functionalParameter.beta[t] = bt;
    const seBt = Math.sqrt(Math.max(0, varBt));
    const z = 1.96;
    functionalParameter.lower[t] = bt - z * seBt;
    functionalParameter.upper[t] = bt + z * seBt;
  }

  const summary = `FOFR Model Summary:
R² = ${r2.toFixed(4)}
RMSE = ${rmse.toFixed(4)}
Number of FPCs: ${p.nComponents}
Sample size: ${n}
Time points: ${L}`;

  return {
    kind: "supervised:regression",
    params: p,
    intercept: functionalCoefficients[0]?.[0] || 0,
    coefficients: functionalCoefficients[0]?.slice(1) || [],
    stderr: functionalStderr[0]?.slice(1) || [],
    tvalues: [],
    pvalues: [],
    featurizer: fpcaResult,
    predictions: allFitted,
    residuals: allResiduals,
    metrics: {
      rmse,
      r2,
      adjR2
    },
    extras: {
      summary,
      functionalParameter,
      fittedFunctionalResponses,
      residualFunctions
    }
  };
}

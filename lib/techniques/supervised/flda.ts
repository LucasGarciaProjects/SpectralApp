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

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1/(1+Math.exp(-z));
}

function normalCDF(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x<0?-1:1; x=Math.abs(x);
  const t = 1/(1+p*x);
  const y = 1-((((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
  return 0.5*(1+sign*y);
}

/* ---------- IRLS / Newton estable ---------- */
type FitOut = { beta: number[]; stderr: number[]; logLikelihood: number; aic: number };

function fitLogisticIRLS(X: number[][], y: number[], maxIter=50, tol=1e-6, ridge=1e-6): FitOut {
  const n = X.length, p = X[0].length;
  let beta = Array(p).fill(0);

  let lastLL = -Infinity;
  for (let it=0; it<maxIter; it++) {
    const eta = X.map(row => row.reduce((s,xj,j)=> s + xj*beta[j], 0));
    const pHat = eta.map(sigmoid);
    const Wdiag = pHat.map(p => Math.max(1e-9, p*(1-p)));

    const grad = Array(p).fill(0);
    for (let j=0;j<p;j++)
      for (let i=0;i<n;i++) grad[j] += X[i][j]*(y[i]-pHat[i]);

    const H = Array.from({length:p},()=>Array(p).fill(0));
    for (let j=0;j<p;j++) for (let k=0;k<p;k++) {
      let s=0;
      for (let i=0;i<n;i++) s += X[i][j]*X[i][k]*Wdiag[i];
      H[j][k] = s + (j===k ? ridge : 0);
    }

    let delta: number[];
    try { delta = solve(H, grad); }
    catch {
      for (let j=0;j<p;j++) H[j][j] += 1e-3;
      delta = solve(H, grad);
    }
    for (let j=0;j<p;j++) beta[j] += delta[j];

    const ll = y.reduce((s,yi,i)=>{
      const pr = Math.min(1-1e-15, Math.max(1e-15, pHat[i]));
      return s + (yi*Math.log(pr) + (1-yi)*Math.log(1-pr));
    },0);
    const maxStep = Math.max(...delta.map(Math.abs));
    if (maxStep < tol || Math.abs(ll - lastLL) < 1e-6) break;
    lastLL = ll;
  }

  const etaF = X.map(row => row.reduce((s,xj,j)=> s + xj*beta[j], 0));
  const pF = etaF.map(sigmoid);
  const W = Array.from({length:n},(_,i)=> Array(n).fill(0).map((__,j)=> i===j ? Math.max(1e-9,pF[i]*(1-pF[i])) : 0));
  const Xt = transpose(X);
  const XtWX = matmul(matmul(Xt, W), X);
  for (let j=0;j<p;j++) XtWX[j][j] += ridge;
  let cov: number[][];
  try { cov = invert(XtWX); }
  catch {
    for (let j=0;j<p;j++) XtWX[j][j] += 1e-3;
    cov = invert(XtWX);
  }
  const stderr = cov.map((_,i)=> Math.sqrt(Math.max(0, cov[i][i])));

  const logLikelihood = y.reduce((s,yi,i)=>{
    const pr = Math.min(1-1e-15, Math.max(1e-15, pF[i]));
    return s + (yi*Math.log(pr) + (1-yi)*Math.log(1-pr));
  },0);
  const aic = -2*logLikelihood + 2*p;

  return { beta, stderr, logLikelihood, aic };
}

/* ---------- ROC ---------- */
function rocFromProba(proba: number[], y: number[]) {
  const thr = Array.from({length:101},(_,i)=> i/100);
  const pts = thr.map(t=>{
    let tp=0,fp=0,tn=0,fn=0;
    for (let i=0;i<y.length;i++) {
      const pred = proba[i] >= t ? 1 : 0;
      if (y[i]===1 && pred===1) tp++;
      else if (y[i]===0 && pred===1) fp++;
      else if (y[i]===0 && pred===0) tn++;
      else fn++;
    }
    const tpr = tp/(tp+fn || 1);
    const fpr = fp/(fp+tn || 1);
    return {tpr,fpr};
  });
  let auc=0;
  for (let i=1;i<pts.length;i++) auc += (pts[i].fpr-pts[i-1].fpr)*(pts[i].tpr+pts[i-1].tpr)/2;
  return { fpr: pts.map(p=>p.fpr), tpr: pts.map(p=>p.tpr), auc };
}

export async function runFLDA(
  X_fd: FunctionalMatrix,
  y: ScalarVector,
  params: unknown
): Promise<SupervisedResult> {
  const p = FPCAParamsSchema.parse(params);

  // Run FPCA on functional predictors
  const fpca = getTechnique("fpca");
  const fpcaResult = await fpca.run(X_fd, null, {
    nComponents: p.nComponents,
    center: p.center,
    scaleScores: p.scaleScores,
    varimax: false
  });

  const n = y.length;
  const X = fpcaResult.scores.map((row: number[]) => [1, ...row.slice(0, p.nComponents)]);

  // For FLDA, we use logistic regression on the FPC scores
  const { beta, stderr, logLikelihood, aic } = fitLogisticIRLS(X, y, 50, 1e-6, 1e-6);
  const intercept = beta[0];
  const coefficients = beta.slice(1);

  const logits = X.map((r: number[]) => r.reduce((s: number, xj: number, j: number) => s + xj*beta[j], 0));
  const proba = logits.map(sigmoid);
  const residuals = y.map((yi,i)=> yi - proba[i]);

  const zvals = beta.map((b,i)=> b / (stderr[i] || Infinity));
  const pvals  = zvals.map(z => 2*(1 - normalCDF(Math.abs(z))));

  const roc = rocFromProba(proba, y);
  const preds = proba.map((p0: number) => p0>=0.5 ? 1 : 0);
  let tp=0,fp=0,tn=0,fn=0;
  for (let i=0;i<n;i++){
    if (y[i]===1 && preds[i]===1) tp++;
    else if (y[i]===0 && preds[i]===1) fp++;
    else if (y[i]===0 && preds[i]===0) tn++;
    else fn++;
  }
  const accuracy = (tp+tn)/n;
  const eps = 1e-15;
  const logLoss = -(1/n)*y.reduce((s,yi,i)=> s + (yi*Math.log(Math.max(eps,proba[i])) + (1-yi)*Math.log(Math.max(eps,1-proba[i]))), 0);

  // Calculate functional parameter β(t)
  const L = X_fd[0].length;
  const functionalParameter = {
    beta: Array(L).fill(0),
    lower: Array(L).fill(0),
    upper: Array(L).fill(0),
    domain: Array.from({length:L},(_,i)=> i+1),
  };
  for (let t=0;t<L;t++) {
    let bt = 0;
    let varBt = 0;
    for (let i=0;i<p.nComponents;i++) {
      const comp_it = fpcaResult.components?.[i]?.[t] ?? 0;
      bt += coefficients[i]*comp_it;
      const se_i = stderr[i+1] ?? 0;
      varBt += (se_i*se_i) * (comp_it*comp_it);
    }
    functionalParameter.beta[t] = bt;
    const seBt = Math.sqrt(Math.max(0, varBt));
    const z = 1.96;
    functionalParameter.lower[t] = bt - z*seBt;
    functionalParameter.upper[t] = bt + z*seBt;
  }

  const summary = `FLDA Model Summary:
Log-likelihood = ${logLikelihood.toFixed(4)}
AIC = ${aic.toFixed(4)}
AUC = ${roc.auc.toFixed(4)}
Number of FPCs: ${p.nComponents}
Sample size: ${n}`;

  return {
    kind: "supervised:classification",
    params: p,
    intercept,
    coefficients,
    stderr,
    tvalues: zvals,
    pvalues: pvals,
    featurizer: fpcaResult,
    proba,
    predictions: preds,
    residuals,
    metrics: {
      accuracy,
      logLoss,
      logLikelihood,
      aic,
      confusion: [[tn,fp],[fn,tp]]
    },
    extras: {
      summary,
      functionalParameter,
      roc,
      confusionAt: (cut: number) => {
        let TP=0,FP=0,TN=0,FN=0;
        for (let i=0;i<n;i++){
          const pr = proba[i] >= cut ? 1 : 0;
          if (y[i]===1 && pr===1) TP++;
          else if (y[i]===0 && pr===1) FP++;
          else if (y[i]===0 && pr===0) TN++;
          else FN++;
        }
        return { TP, FP, TN, FN };
      }
    }
  };
}

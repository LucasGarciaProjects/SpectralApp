/**
 * Análisis de Componentes Independientes Funcional (FICA)
 * --------------------------------------------------------
 * FastICA estable con blanqueo SVD correcto y reconstrucción por mínimos cuadrados.
 */

import * as numeric from "numeric";

export type FICAIntermediate = {
  scores: number[][];      // n × m
  components: number[][];  // m × p
  contribution: number[];
  cumulative: number[];
  centerFunc?: number[];
  explainedVariance?: number[];   // alias para UI
  cumulativeVariance?: number[];  // alias para UI
  center?: number[];              // alias para UI
  meta?: { method: string };
};

// ---------- funciones auxiliares ----------
const isFiniteNum = (x: number) => Number.isFinite(x) && !Number.isNaN(x);
const sanitizeVec = (v: number[]) => v.map(x => (isFiniteNum(x) ? x : 0));
const sanitizeMat = (M: number[][]) => M.map(sanitizeVec);

function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map(r => r[j]));
}
function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length, m = B[0].length, p = B.length;
  const C = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  }
  return C;
}
function normalize(v: number[]): number[] {
  const nrm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return nrm > 0 ? v.map(x => x / nrm) : v.map(() => 0);
}
function centerMatrix(X: number[][]): { Xc: number[][]; mean: number[] } {
  const n = X.length, p = X[0].length;
  const mean = Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    let s = 0; for (let i = 0; i < n; i++) s += X[i][j];
    mean[j] = s / n;
  }
  const Xc = X.map(r => r.map((x, j) => x - mean[j]));
  return { Xc, mean };
}

// ---------- blanqueo ----------
function whitenSVD(Xc: number[][], eps = 1e-10) {
  const n = Xc.length, p = Xc[0].length;
  let U: number[][], S: number[], V: number[][];

  if (n >= p) {
    const svd: any = numeric.svd(Xc);
    U = svd.U as number[][]; S = svd.S as number[]; V = svd.V as number[][];
  } else {
    const Xt = transpose(Xc);
    const svd: any = numeric.svd(Xt);
    const U_t = svd.U as number[][]; // p×p
    const V_t = svd.V as number[][]; // n×n
    U = V_t; S = svd.S as number[]; V = U_t;
  }

  const r = Math.max(1, S.filter(v => v > eps).length);
  const S_r = S.slice(0, r).map(v => (v < eps ? eps : v));
  const V_r = V.map(row => row.slice(0, r));

  // Z = Xc * V_r * diag(1/S_r)  (equivale a U_r)
  const Dinv = Array.from({ length: r }, (_, i) =>
    Array.from({ length: r }, (_, j) => (i === j ? 1 / S_r[i] : 0))
  );
  const Z = matMul(matMul(Xc, V_r), Dinv); // n×r

  return { Z, V_r, S_r, rank: r };
}

// ---------- FastICA ----------
function g(u: number) { return Math.tanh(u); }
function gPrime(u: number) { return 1 - Math.tanh(u) ** 2; }

function fastICA(Z: number[][], nComp: number, maxIter = 300, tol = 1e-5): number[][] {
  const n = Z.length, r = Z[0].length;
  const m = Math.min(Math.max(1, nComp | 0), r);
  const W: number[][] = [];

  for (let c = 0; c < m; c++) {
    let w = Array(r).fill(0).map(() => Math.random() - 0.5);
    w = normalize(w);

    for (let it = 0; it < maxIter; it++) {
      const Zw = Z.map(z => z.reduce((s, val, j) => s + val * w[j], 0));
      const Eg = Array(r).fill(0);
      for (let i = 0; i < n; i++) {
        const gi = g(Zw[i]);
        for (let j = 0; j < r; j++) Eg[j] += (Z[i][j] * gi) / n;
      }
      const Egp = Zw.reduce((s, v) => s + gPrime(v), 0) / n;

      let wNew = Eg.map((v, j) => v - Egp * w[j]);
      for (let d = 0; d < c; d++) {
        const dot = wNew.reduce((s, v, j) => s + v * W[d][j], 0);
        wNew = wNew.map((v, j) => v - dot * W[d][j]);
      }
      wNew = normalize(wNew);

      const cos = w.reduce((s, v, j) => s + v * wNew[j], 0);
      if (Math.abs(Math.abs(cos) - 1) < tol) { w = wNew; break; }
      w = wNew;
    }
    W.push(w);
  }

  return W; // m×r
}

// ---------- API ----------
export function ficaFromData(X: number[][], nComp: number, center = true): FICAIntermediate {
  if (!Array.isArray(X) || X.length === 0 || X[0].length === 0) {
    return { scores: [[]], components: [[]], contribution: [], cumulative: [], meta: { method: "fastica" } };
  }

  const { Xc, mean } = centerMatrix(X);
  const { Z, rank } = whitenSVD(Xc);
  const m = Math.min(Math.max(1, nComp | 0), rank, X.length);

  const W  = fastICA(Z, m);           // m×r
  const Wt = transpose(W);            // r×m
  let S_ica = matMul(Z, Wt);          // n×m

  // Componentes LSQ: C = (S^T S)^-1 S^T Xc   => m×p
  const St = transpose(S_ica);               // m×n
  const StS = matMul(St, S_ica);             // m×m
  
  // Calcular pseudo-inversa manualmente para robustez
  let StS_inv: number[][];
  try {
    StS_inv = numeric.inv(StS) as number[][];
  } catch {
    // Si falla la inversión, usar pseudo-inversa de Moore-Penrose
    const [U, S, Vt] = numeric.svd(StS) as any;
    const Sinv = S.map((s: number) => s > 1e-10 ? 1/s : 0);
    const SinvDiag = Array.from({ length: S.length }, (_, i) =>
      Array.from({ length: S.length }, (_, j) => i === j ? Sinv[i] : 0)
    );
    StS_inv = matMul(matMul(Vt.map((r: number[]) => r.slice(0, S.length)), SinvDiag), transpose(U.slice(0, S.length)));
  }
  
  const Xlsq = matMul(StS_inv, St);          // m×n
  let C = matMul(Xlsq, Xc);                  // m×p

  // Sanitizar para eliminar NaN/Inf
  S_ica = sanitizeMat(S_ica);
  C     = sanitizeMat(C);

  // Energía por componente (Frobenius del término rank-1): ||s_j||^2 * ||c_j||^2
  const scoreNorm2 = Array.from({ length: m }, (_, j) =>
    S_ica.reduce((s, r) => s + r[j] * r[j], 0)
  );
  const compNorm2 = Array.from({ length: m }, (_, j) =>
    C[j].reduce((s, v) => s + v * v, 0)
  );
  const energy = scoreNorm2.map((sj2, j) => sj2 * compNorm2[j]);
  const total  = energy.reduce((s, v) => s + v, 0);
  const contribution = total > 0 ? energy.map(e => (e / total) * 100) : Array(m).fill(0);
  const cumulative   = contribution.map((v, i) => contribution.slice(0, i + 1).reduce((s, x) => s + x, 0));

  // Trazas de debug
  console.debug("[FICA algo] formas:",
    { scores: [S_ica.length, S_ica[0]?.length ?? 0],
      components: [C.length, C[0]?.length ?? 0],
      contributionLen: contribution.length,
      cumulativeLen: cumulative.length,
      centerLen: (mean ?? []).length });
  console.debug("[FICA algo] primeros:",
    { s00: S_ica[0]?.[0], c00: C[0]?.[0], contrib0: contribution[0], cum0: cumulative[0] });

  return {
    scores: S_ica,
    components: C,
    contribution,
    cumulative,
    // alias para la UI/registry
    explainedVariance: contribution,
    cumulativeVariance: cumulative,
    center: mean,
    centerFunc: mean,
    meta: { method: "fastica-svd-lsq" },
  };
}

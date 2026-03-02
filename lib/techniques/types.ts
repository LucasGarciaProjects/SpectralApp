import { z } from "zod";

export type TaskKind = "supervised:regression" | "supervised:classification" | "unsupervised" | "descriptive";

export type FunctionalMatrix = number[][];     // nObs x nGrid (o espacio de base)
export type ScalarVector = number[];           // y para supervised
export type ScoresMatrix = number[][];         // nObs x nComp
export type ComponentsMatrix = number[][];     // nComp x nGrid

export interface FeaturizerResult {
  scores: ScoresMatrix;
  components?: ComponentsMatrix;
  explainedVariance?: number[]; // % variance per component (suma=100)
  cumulativeVariance?: number[];   // %
  center?: number[];           // media de funciones (si aplica)
  meta?: Record<string, any>;
}

export type SupervisedModelResult = {
  coefficients: number[];            // intercept + betas
  stderr?: number[];                 // standard errors (if available)
  tvalues?: number[];                // t-values (linear only)
  pvalues?: number[];                // p-values (linear/logistic)

  fitted: number[];                  // fitted values (linear: ŷ, logistic: probabilities)
  residuals: number[];               // residuals (y - fitted)

  r2?: number;                       // R² (linear)
  adjR2?: number;                    // Adjusted R² (linear)
  logLikelihood?: number;            // log-likelihood (logistic)
  aic?: number;                      // Akaike Information Criterion (logistic)

  summary: string;                   // textual summary for console/debug
  functionalParameter?: {            // β(t) function + CI
    beta: number[];
    lower?: number[];
    upper?: number[];
    domain?: number[];
  };

  // Optional extra metrics depending on method
  roc?: { fpr: number[]; tpr: number[]; auc: number };
  confusion?: (cutoff: number) => { TP: number; FP: number; TN: number; FN: number };

  meta?: { method: string; nComponents: number; responseType: "continuous" | "binary" };
};

export interface SupervisedMetricsRegression {
  rmse: number;
  r2: number;
  adjR2?: number;
}

export interface SupervisedMetricsClassification {
  accuracy: number;
  logLoss: number;
  logLikelihood?: number;
  aic?: number;
  rocAuc?: number;
  prAuc?: number;
  confusion?: number[][];
}

export type SupervisedMetrics = SupervisedMetricsRegression | SupervisedMetricsClassification;

export interface CVFoldResult<TMetrics = any> {
  fold: number;
  metrics: TMetrics;
}

export interface SupervisedResult<TOut = any> {
  kind: TaskKind;
  params: Record<string, any>;
  coefficients?: number[];   // en espacio de scores
  intercept?: number;
  stderr?: number[];         // standard errors
  tvalues?: number[];        // t-values or z-values
  pvalues?: number[];        // p-values
  residuals?: number[];      // residuals
  featurizer?: FeaturizerResult;
  metrics?: SupervisedMetrics;
  cv?: CVFoldResult[];
  predictions?: number[];
  proba?: number[];          // clasificación
  extras?: TOut;
}

export const FPCAParamsSchema = z.object({
  nComponents: z.number().int().min(1),
  center: z.boolean().default(true),
  scaleScores: z.boolean().default(false),
  varimax: z.boolean().default(false),
});

export const RidgeParamsSchema = z.object({
  alpha: z.number().min(0).default(1e-3),
  fitIntercept: z.boolean().default(true),
});

export type FPCAParams = z.infer<typeof FPCAParamsSchema>;
export type RidgeParams = z.infer<typeof RidgeParamsSchema>;

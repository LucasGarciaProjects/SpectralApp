/**
 * Implementación de Análisis de Componentes Principales Funcional (FPCA)
 * 
 * Este módulo proporciona la implementación de la técnica FPCA para análisis
 * de datos funcionales no supervisados. Soporta:
 * - Centrado y preprocesamiento de datos
 * - Cálculo de FPCA basado en covarianza
 * - Rotación Varimax opcional para interpretabilidad
 * - Número configurable de componentes
 * - Opciones de escalado de scores
 */

import { FPCAParamsSchema, FunctionalMatrix, FeaturizerResult } from "../types";
import { fpcaFromCovariance, applyVarimaxToFpca } from "../../fpca-algorithm";
export async function runFPCA(
  X_fd: FunctionalMatrix,
  params: unknown
): Promise<FeaturizerResult> {
  const safeParams = {
    nComponents: 3,
    center: true,
    scaleScores: false,
    varimax: false,
    ...(typeof params === "object" && params !== null ? params as Record<string, unknown> : {}),
  };
  const p = FPCAParamsSchema.parse(safeParams);

  // 1) Cálculo base de FPCA
  const base = fpcaFromCovariance(X_fd, p.nComponents, p.center);

  // 2) Rotación Varimax opcional
  const final = p.varimax ? applyVarimaxToFpca(base) : base;

  // 3) Escalar scores si se solicita
  let scores = final.scores;
  if (p.scaleScores) {
    const m = scores[0]?.length ?? 0;
    const sd = new Array(m).fill(0).map((_, j) =>
      Math.sqrt(
        scores.reduce((s, r) => s + r[j] * r[j], 0) /
          Math.max(scores.length - 1, 1)
      )
    );
    scores = scores.map(r =>
      r.map((v, j) => (sd[j] > 0 ? v / sd[j] : v))
    );
  }

  return {
    scores,
    components: final.components,
    explainedVariance: final.explainedVariance,
    cumulativeVariance: final.cumulativeVariance,
    center: final.centerFunc,
    meta: final.meta,
  };
}

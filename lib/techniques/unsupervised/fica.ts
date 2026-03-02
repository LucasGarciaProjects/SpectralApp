/**
 * Análisis de Componentes Independientes Funcional (FICA)
 * -------------------------------------------------------
 * Técnica no supervisada similar a FPCA, pero extrae componentes estadísticamente
 * independientes en lugar de no correlacionados.
 */

import { FunctionalMatrix, FeaturizerResult } from "../types";
import { ficaFromData } from "@/lib/fica-algorithm";

type FICAParams = {
  nComponents?: number;
  center?: boolean;
};

export async function runFICA(
  X_fd: FunctionalMatrix,
  params: unknown
): Promise<FeaturizerResult> {
  const safeParams = {
    nComponents: 3,
    center: true,
    ...(typeof params === "object" && params !== null ? params as FICAParams : {}),
  };

  const res = ficaFromData(X_fd, safeParams.nComponents, safeParams.center);

  return {
    scores: res.scores,
    components: res.components,
    explainedVariance: res.contribution,
    cumulativeVariance: res.cumulative,
    center: res.centerFunc ?? undefined,
    meta: res.meta,
  };
}


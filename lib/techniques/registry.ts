/**
 * Registro y Factory de Técnicas
 * 
 * Este módulo proporciona un registro centralizado para todas las técnicas de
 * análisis de datos funcionales disponibles en la aplicación. Gestiona:
 * - Registro y descubrimiento de técnicas
 * - Validación de parámetros usando esquemas Zod
 * - Carga diferida de implementaciones de técnicas
 * - Ejecución type-safe de técnicas
 * - Soporte para métodos supervisados y no supervisados
 */

import { z } from "zod";
import { TaskKind, FPCAParamsSchema, RidgeParamsSchema } from "./types";

export type TechniqueId = 
  | "fpca"
  | "fica"
  | "fpcr"
  | "fpclor";

export interface TechniqueSpec {
  id: TechniqueId;
  name: string;
  kind: TaskKind;
  paramsSchema: z.ZodTypeAny;
  // Lazy loading of executor to avoid bloating the bundle
  run: (X_fd: any, y: any, params: any) => Promise<any>;
}

// Esquemas extendidos para técnicas supervisadas
const FPCRParamsSchema = RidgeParamsSchema.extend({
  nComponents: FPCAParamsSchema.shape.nComponents,
  center: FPCAParamsSchema.shape.center,
  scaleScores: FPCAParamsSchema.shape.scaleScores,
});

const FPCLoRParamsSchema = RidgeParamsSchema.extend({
  nComponents: FPCAParamsSchema.shape.nComponents,
  center: FPCAParamsSchema.shape.center,
  scaleScores: FPCAParamsSchema.shape.scaleScores,
});

export const TECHNIQUES: Record<TechniqueId, TechniqueSpec> = {
  fpca: {
    id: "fpca",
    name: "Functional PCA",
    kind: "unsupervised",
    paramsSchema: FPCAParamsSchema,
    run: async (X_fd, y, params) => {
      const { runFPCA } = await import("./unsupervised/fpca");
      // Pasamos params tal cual, para que runFPCA maneje defaults
      return runFPCA(X_fd, params);
    },
  },
  fica: {
    id: "fica",
    name: "Functional ICA",
    kind: "unsupervised",
    paramsSchema: FPCAParamsSchema, // reuse same param schema
    run: async (X_fd, y, params) => {
      const { runFICA } = await import("./unsupervised/fica");
      return runFICA(X_fd, params);
    },
  },
  fpcr: {
    id: "fpcr",
    name: "FPCR (linear)",
    kind: "supervised:regression",
    paramsSchema: FPCRParamsSchema,
    run: async (X_fd, y, params) => {
      const { runFPCR } = await import("./supervised/fpcr");
      return runFPCR(X_fd, y, params);
    },
  },
  fpclor: {
    id: "fpclor",
    name: "FPCLoR (logistic)",
    kind: "supervised:classification",
    paramsSchema: FPCLoRParamsSchema,
    run: async (X_fd, y, params) => {
      const { runFPCLoR } = await import("./supervised/fpclor");
      return runFPCLoR(X_fd, y, params);
    },
  },
};

// Funciones auxiliares para trabajar con el registro
export function getTechnique(id: TechniqueId): TechniqueSpec {
  const t = TECHNIQUES[id];
  if (!t) throw new Error(`Technique not found: ${id}`);
  return t;
}

export async function runTechnique<T = any>(id: TechniqueId, X_fd: any, y: any, params: any): Promise<T> {
  const t = getTechnique(id);
  return await t.run(X_fd, y, params);
}

export function getAllTechniques(): TechniqueSpec[] {
  return Object.values(TECHNIQUES);
}

export function getTechniquesByKind(kind: TaskKind): TechniqueSpec[] {
  return Object.values(TECHNIQUES).filter(t => t.kind === kind);
}

export function getUnsupervisedTechniques(): TechniqueSpec[] {
  return getTechniquesByKind("unsupervised");
}

export function getSupervisedTechniques(): TechniqueSpec[] {
  return Object.values(TECHNIQUES).filter(t => 
    t.kind.startsWith("supervised:")
  );
}

export function getDescriptiveTechniques(): TechniqueSpec[] {
  return getTechniquesByKind("descriptive");
}

/**
 * Hook de Gestión de Estado de la Aplicación
 * 
 * Este módulo proporciona el hook principal de gestión de estado para la
 * aplicación de análisis espectral usando Zustand. Define:
 * - Tipos de datos centrales para datos espectrales y escalares
 * - Estructura y gestión de datasets funcionales
 * - Configuración de dominio para análisis funcional
 * - Interfaz y acciones del estado de la aplicación
 * - Utilidades type-safe para gestión de estado
 */

import { create } from 'zustand';

export type SpectralMatrix = number[][];
export type ScalarMatrix = Record<string, number | string>[];  // Asume que las variables escalares tienen encabezados

export type FunctionalDataset = {
  id: string;
  label: string;
  method: 'bspline' | 'fourier' | 'wavelet';
  data: number[][];      // Valores funcionales (evaluados)
  coefficients?: number[][]; // Coeficientes de base, si están disponibles
  parameters: Record<string, any>;
  derivedOrder?: 0 | 1 | 2;  // 0=original, 1=1ª derivada, 2=2ª derivada
};

export type DomainConfig = {
  startWavelength: number;
  endWavelength: number;
  nPoints: number;
  stepSize: number;
  isConfirmed: boolean;
};

export interface AppState {
  // Almacenamiento de Datos
  rawData: number[][] | null;
  scalarData: number[][] | null;
  scalarMeta?: {
    hasHeaders: boolean;
    decimalSeparator: string; // "." | ","
    columnSeparator: string;  // ",", ";", "\t" ...
    categoricalColumns?: number[]; // índices con variables categóricas
    columnNames?: string[];   // en caso de no tener headers originales
  } | null;
  domain: DomainConfig | null;
  functionalBases: FunctionalDataset[];
  selectedBaseIndex: number | null;
  // Configuración
  settings: {
    decimalSeparator: '.' | ',';
    columnSeparator: ',' | ';' | '\t';
    hasHeaders: boolean;
  };
  // Preferencias de visualización/funcionalización
  vizPrefs: {
    xAxisTitle: string;
    yAxisTitle: string;
    highlightSingleCurve: boolean;   // si false: todas mismo color
    derivativeOrder: 0 | 1 | 2;      // 0: original, 1: 1ª derivada, 2: 2ª derivada
  };
  techniqueParams: {
    fpca: { nComponents: number; center: boolean; scaleScores: boolean };
    fpcr: { nComponents: number; center: boolean; scaleScores: boolean; alpha: number; fitIntercept: boolean };
    fpclor: { nComponents: number; center: boolean; scaleScores: boolean; alpha: number; fitIntercept: boolean };
  };
  // Actions
  setRawData: (data: number[][]) => void;
  setScalarData: (data: number[][], meta?: AppState["scalarMeta"]) => void;
  setDomain: (domain: DomainConfig) => void;
  addFunctionalDataset: (dataset: FunctionalDataset) => void;
  removeFunctionalDataset: (id: string) => void;
  selectFunctionalDataset: (index: number) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  setTechniqueParams: <K extends keyof AppState["techniqueParams"]>(key: K, params: Partial<AppState["techniqueParams"][K]>) => void;
  setVizPrefs: (patch: Partial<AppState["vizPrefs"]>) => void;
  resetAll: () => void;
};

export const useAppState = create<AppState>((set) => ({
  rawData: null,
  scalarData: null,
  scalarMeta: null,
  functionalBases: [],
  selectedBaseIndex: null,
  domain: null,
  settings: {
    decimalSeparator: '.',
    columnSeparator: ',',
    hasHeaders: true,
  },
  vizPrefs: {
    xAxisTitle: "Wavelength",
    yAxisTitle: "Intensity",
    highlightSingleCurve: true,
    derivativeOrder: 0,
  },
  techniqueParams: {
    fpca: { nComponents: 5, center: true, scaleScores: false },
    fpcr: { nComponents: 5, center: true, scaleScores: false, alpha: 1e-2, fitIntercept: true },
    fpclor: { nComponents: 5, center: true, scaleScores: false, alpha: 1e-2, fitIntercept: true },
  },
  setRawData: (data) => set({ rawData: data }),
  setScalarData: (data, meta) => set({ scalarData: data, scalarMeta: meta ?? null }),
  addFunctionalDataset: (dataset) =>
    set((state) => {
      if (state.functionalBases.length >= 5) return state;
      return { functionalBases: [...state.functionalBases, dataset] };
    }),
  removeFunctionalDataset: (id) =>
    set((state) => {
      const newBases = state.functionalBases.filter(dataset => dataset.id !== id);
      const removedIndex = state.functionalBases.findIndex(dataset => dataset.id === id);
      let newSelectedIndex = state.selectedBaseIndex;
      
      // Adjust selected index if necessary
      if (removedIndex === state.selectedBaseIndex) {
        newSelectedIndex = newBases.length > 0 ? 0 : null;
      } else if (removedIndex < (state.selectedBaseIndex || 0)) {
        newSelectedIndex = (state.selectedBaseIndex || 0) - 1;
      }
      
      return { 
        functionalBases: newBases,
        selectedBaseIndex: newSelectedIndex
      };
    }),
  selectFunctionalDataset: (index) => set({ selectedBaseIndex: index }),
  setDomain: (domain) => set({ domain }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  setTechniqueParams: (key, params) => set(state => ({
    techniqueParams: { 
      ...state.techniqueParams, 
      [key]: { ...state.techniqueParams[key], ...params } 
    }
  })),
  setVizPrefs: (patch) => set((state) => ({ vizPrefs: { ...state.vizPrefs, ...patch } })),
  resetAll: () =>
    set({
      rawData: null,
      scalarData: null,
      scalarMeta: null,
      functionalBases: [],
      selectedBaseIndex: null,
      domain: null,
      settings: {
        decimalSeparator: '.',
        columnSeparator: ',',
        hasHeaders: true,
      },
      vizPrefs: {
        xAxisTitle: "Wavelength",
        yAxisTitle: "Intensity",
        highlightSingleCurve: true,
        derivativeOrder: 0,
      },
      techniqueParams: {
        fpca: { nComponents: 5, center: true, scaleScores: false },
        fpcr: { nComponents: 5, center: true, scaleScores: false, alpha: 1e-2, fitIntercept: true },
        fpclor: { nComponents: 5, center: true, scaleScores: false, alpha: 1e-2, fitIntercept: true },
      },
    }),
}));
/**
 * Componente de Vista de Análisis de Componentes Principales Funcional (FPCA)
 * 
 * Este componente proporciona una interfaz completa para realizar y visualizar
 * Análisis de Componentes Principales Funcional sobre datos espectrales. Incluye:
 * - Análisis y visualización de varianza explicada
 * - Visualización de loadings de FPC con efectos de perturbación
 * - Gráficos de dispersión de scores de FPC y análisis de correlación
 * - Reconstrucción de curvas con número configurable de componentes
 * - Funcionalidad de exportación de datos para loadings y scores
 * - Soporte para carga y análisis de variables adicionales
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import ClientPlot from "@/components/common/ClientPlot";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { FeaturizerResult } from "@/lib/techniques/types";
import { FunctionalDataset } from "@/hooks/useAppState";
import { getTechnique } from "@/lib/techniques/registry";

type AdditionalVar =
  | { name: string; type: "numeric"; values: number[] }
  | { name: string; type: "categorical"; values: string[]; categories: string[] };

type FPCAActive = {
  scores: number[][];
  components: number[][];
  explained: number[];
  cumulative: number[];
  mean: number[] | null;
};

interface Props {
  functionalDataset: FunctionalDataset;
}

export default function FPCAView({ functionalDataset }: Props) {
  const nObs = functionalDataset.data.length;
  const pGrid = functionalDataset.data[0].length;
  const domainX = useMemo(
    () => Array.from({ length: pGrid }, (_, j) => j + 1),
    [pGrid]
  );

  // FPCA Parameters
  const [nFPC, setNFPC] = useState<number>(3);
  const [fpcaBase, setFpcaBase] = useState<FPCAActive | null>(null);
  const [fpcaActive, setFpcaActive] = useState<FPCAActive | null>(null);
  const [rotated, setRotated] = useState(false);

  // UI State
  const [innerTab, setInnerTab] = useState<"explained" | "loadings" | "scores" | "recon">("explained");
  const [loadingIndex, setLoadingIndex] = useState<number>(0);
  const [perturb, setPerturb] = useState<number>(1.0);
  const [xAxisChoice, setXAxisChoice] = useState<string>("FPC 1");
  const [yAxisChoice, setYAxisChoice] = useState<string>("FPC 2");
  const [selectedIdx, setSelectedIdx] = useState<number[]>([]);
  // Controls persistence of Plotly selection UI; increment to apply changes
  const [selectionRevision, setSelectionRevision] = useState<number>(0);
  // Persistent visual rectangle for box selection
  const [selectionRect, setSelectionRect] = useState<
    { x0: number; x1: number; y0: number; y1: number } | null
  >(null);
  // Prevent automatic deselection
  const [selectionLocked, setSelectionLocked] = useState<boolean>(false);
  // Store the raw selection data to prevent loss
  const [rawSelectionData, setRawSelectionData] = useState<any>(null);
  const leftPlotRef = useRef<any>(null);
  const [reconCurveIndex, setReconCurveIndex] = useState<number>(0);
  const [reconNFPC, setReconNFPC] = useState<number>(1);
  const [additionalVars, setAdditionalVars] = useState<AdditionalVar[]>([]);

  // Maintain selection persistence
  useEffect(() => {
    if (rawSelectionData && selectionLocked) {
      // Force update the plot with persistent selection
      const plotElement = leftPlotRef.current
      if (plotElement && plotElement.Plotly) {
        const update = {
          'data[0].selectedpoints': rawSelectionData.indices,
          'data[0].selected': { marker: { color: '#FF4500', size: 9 } },
          'data[0].unselected': { marker: { opacity: 0.35 } }
        }
        plotElement.Plotly.restyle(plotElement, update)
      }
    }
  }, [rawSelectionData, selectionLocked, selectionRevision])

  // =========================
  // Helper Functions
  // =========================
  // Calculate column-wise standard deviations for perturbation visualization
  const colStd = (X: number[][]) => {
    const n = X.length, k = X[0].length;
    const means = Array(k).fill(0);
    // Calculate column means
    for (let j = 0; j < k; j++) {
      let s = 0; for (let i = 0; i < n; i++) s += X[i][j];
      means[j] = s / n;
    }
    const stds = Array(k).fill(0);
    // Calculate column standard deviations
    for (let j = 0; j < k; j++) {
      let s = 0; for (let i = 0; i < n; i++) s += (X[i][j] - means[j]) ** 2;
      stds[j] = Math.sqrt(s / Math.max(n - 1, 1));
    }
    return stds;
  };

  function downloadCSV(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================
  // FPCA Execution
  // =========================
  const runFPCA = async (opts?: { varimax?: boolean; nComponents?: number }) => {
    const fpca = getTechnique("fpca");
    const componentsToUse = opts?.nComponents ?? nFPC;

    const res: FeaturizerResult = await fpca.run(
      functionalDataset.data,
      null, // y = null for FPCA (unsupervised)
      {
      nComponents: componentsToUse,
      center: true,
      scaleScores: false,
      varimax: opts?.varimax ?? false,
      }
    );

    const active: FPCAActive = {
      scores: res.scores,
      components: res.components || [],
      explained: res.explainedVariance || [],
      cumulative: res.cumulativeVariance || [],
      mean: res.center || null,
    };
    setFpcaBase(active);
    setFpcaActive(active);
    setRotated(opts?.varimax ?? false);
    setLoadingIndex(0);
    setSelectedIdx([]);
    setReconNFPC(Math.min(1, componentsToUse));
    // setAdditionalVars([]); // Reset additional variables when recalculating
  };

  // Recalculate FPCA when dataset or number of components changes
  useEffect(() => {
    runFPCA({ nComponents: nFPC }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functionalDataset, nFPC]);

  const tryVarimax = () => runFPCA({ varimax: true, nComponents: nFPC });
  const resetRotation = () => runFPCA({ varimax: false, nComponents: nFPC });

  // =========================
  // Additional Variables Upload (CSV)
  // =========================
  const handleUploadVars = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const delimiter = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return;

      const headers = lines[0].split(delimiter).map((h) => h.trim());
      const cols: string[][] = headers.map(() => []);

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter);
        headers.forEach((_, j) => cols[j].push((parts[j] ?? "").trim()));
      }

      const vars: AdditionalVar[] = [];
      for (let j = 0; j < headers.length; j++) {
        const arr = cols[j];
        if (arr.length !== nObs) continue;
        const nums = arr.map((v) => Number(v));
        const isNumeric = nums.every((v, idx) => !isNaN(v) || arr[idx] === "");
        if (isNumeric) {
          vars.push({ name: headers[j], type: "numeric", values: nums.map((v) => (isNaN(v) ? 0 : v)) });
        } else {
          const categories = Array.from(new Set(arr));
          vars.push({ name: headers[j], type: "categorical", values: arr, categories });
        }
      }
      setAdditionalVars(vars);
      const allX = [
        ...(fpcaActive ? fpcaActive.scores[0].map((_, i) => `FPC ${i + 1}`) : []),
        ...vars.map((v) => v.name),
      ];
      if (!allX.includes(xAxisChoice)) {
        setXAxisChoice(allX[0] ?? "FPC 1");
      }
    } catch (e) {
      console.error("[FPCA] Error processing CSV file:", e);
    }
  };

  // =========================
  // Data Export Functions
  // =========================
  const downloadLoadings = () => {
    if (!fpcaActive) return;
    const k = fpcaActive.components.length;
    const p = fpcaActive.components[0].length;
    const header = ["x", ...Array.from({ length: k }, (_, i) => `FPC${i + 1}`)].join(",");
    const rows = Array.from({ length: p }, (_, j) =>
      [String(domainX[j]), ...Array.from({ length: k }, (_, i) => String(fpcaActive.components[i][j]))].join(",")
    ).join("\n");
    downloadCSV(`${functionalDataset.label || "dataset"}_fpc_loadings.csv`, `${header}\n${rows}`);
  };

  const downloadScores = () => {
    if (!fpcaActive) return;
    const k = fpcaActive.components.length;
    const header = Array.from({ length: k }, (_, i) => `FPC${i + 1}`).join(",");
    const rows = fpcaActive.scores.map((r) => r.join(",")).join("\n");
    downloadCSV(`${functionalDataset.label || "dataset"}_fpc_scores.csv`, `${header}\n${rows}`);
  };

  // =========================
  // Curve Reconstruction
  // =========================
  const meanFunction = useMemo(() => {
    if (fpcaActive?.mean && fpcaActive.mean.length === pGrid) return fpcaActive.mean;
    const mean = new Array(pGrid).fill(0);
    for (let j = 0; j < pGrid; j++) {
      let s = 0; for (let i = 0; i < nObs; i++) s += functionalDataset.data[i][j];
      mean[j] = s / nObs;
    }
    return mean;
  }, [fpcaActive, functionalDataset.data, nObs, pGrid]);

  const reconCurve = useMemo(() => {
    if (!fpcaActive) return null;
    const i = reconCurveIndex;
    const m = Math.min(reconNFPC, fpcaActive.components.length);
    const base = meanFunction.slice();
    for (let k = 0; k < m; k++) {
      const sk = fpcaActive.scores[i][k];
      const loadk = fpcaActive.components[k];
      for (let j = 0; j < pGrid; j++) base[j] += sk * loadk[j];
    }
    return base;
  }, [fpcaActive, reconCurveIndex, reconNFPC, meanFunction, pGrid]);

  // =========================
  // Scores Analysis Helpers
  // =========================
  const axisXOptions = useMemo(() => {
    const fpcOpts = fpcaActive ? fpcaActive.scores[0].map((_, k) => `FPC ${k + 1}`) : [];
    return [...fpcOpts, ...additionalVars.map((v) => v.name)];
  }, [fpcaActive, additionalVars]);

  const axisYOptions = useMemo(() => {
    const fpcOpts = fpcaActive ? fpcaActive.scores[0].map((_, k) => `FPC ${k + 1}`) : [];
    return [...fpcOpts, ...additionalVars.map((v) => v.name)];
  }, [fpcaActive, additionalVars]);

  const getAxisData = (name: string): { type: "numeric" | "categorical"; valuesNum?: number[]; valuesCat?: string[] } => {
    if (!fpcaActive) return { type: "numeric", valuesNum: [] };
    if (name.startsWith("FPC ")) {
      const idx = parseInt(name.replace("FPC ", "")) - 1;
      return { type: "numeric", valuesNum: fpcaActive.scores.map((r) => r[idx]) };
    }
    const v = additionalVars.find((a) => a.name === name);
    if (!v) return { type: "numeric", valuesNum: [] };
    if (v.type === "numeric") return { type: "numeric", valuesNum: v.values };
    return { type: "categorical", valuesCat: v.values };
  };

  // Calculate Pearson correlation coefficient between two variables
  const pearson = (x: number[], y: number[]) => {
    const n = x.length;
    let mx = 0, my = 0;
    // Calculate means
    for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n; my /= n;
    let num = 0, dx = 0, dy = 0;
    // Calculate correlation coefficient
    for (let i = 0; i < n; i++) {
      const a = x[i] - mx, b = y[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
  };

  // =========================
  // Component Render
  // =========================
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Number of FPCs</Label>
              <Select value={String(nFPC)} onValueChange={(v) => setNFPC(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: Math.min(12, pGrid) }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={tryVarimax} disabled={!fpcaActive}>
                Try varimax rotation
              </Button>
              <Button variant="outline" onClick={resetRotation} disabled={!rotated}>
                Reset FPCA
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Upload additional variables (CSV)</Label>
              <Input type="file" accept=".csv,.txt" onChange={(e) => handleUploadVars(e.target.files?.[0] ?? null)} />
              {additionalVars.length > 0 && (
                <p className="text-xs text-green-600">
                  ✅ {additionalVars.length} variable(s) uploaded successfully.
                </p>
              )}
              {additionalVars.length > 0 && (
                <div className="pt-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setAdditionalVars([])}
                  >
                    Clear variables
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => runFPCA({ nComponents: nFPC })}>Show FPCA</Button>
            </div>
            <div className="pt-2 border-t mt-2">
              <p className="text-sm font-medium mb-2">Download:</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadLoadings} disabled={!fpcaActive}>
                  Discretized FPC loadings
                </Button>
                <Button variant="outline" onClick={downloadScores} disabled={!fpcaActive}>
                  FPC scores
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>
              Explained variance {rotated ? "(varimax rotated)" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as any)}>
              <TabsList>
                <TabsTrigger value="explained">Explained variance</TabsTrigger>
                <TabsTrigger value="loadings" disabled={!fpcaActive}>FPC loadings</TabsTrigger>
                <TabsTrigger value="scores" disabled={!fpcaActive}>FPC scores</TabsTrigger>
                <TabsTrigger value="recon" disabled={!fpcaActive}>Curves reconstruction</TabsTrigger>
              </TabsList>

              {/* Explained variance */}
              <TabsContent value="explained" className="mt-4">
                {fpcaActive ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ClientPlot
                      data={[{
                        x: fpcaActive.explained.map((_, i) => `FPC ${i + 1}`),
                        y: fpcaActive.explained,
                        type: "bar",
                        name: "Explained variance (%)",
                        hovertemplate: "%{x}: %{y:.2f}%<extra></extra>",
                      } as any]}
                      layout={{
                        title: "Variance explained by each FPC",
                        margin: { t: 40, r: 10, l: 50, b: 40 },
                        yaxis: { title: "Percentage (%)", rangemode: "tozero" },
                        showlegend: true,
                      }}
                      style={{ width: "100%", height: "360px" }}
                    />
                    <ClientPlot
                      data={[{
                        x: fpcaActive.explained.map((_, i) => `FPC ${i + 1}`),
                        y: fpcaActive.cumulative,
                        type: "scatter",
                        mode: "lines+markers",
                        name: "Cumulative variance (%)",
                        hovertemplate: "%{x}: %{y:.2f}%<extra></extra>",
                      } as any]}
                      layout={{
                        title: "Cumulative variance",
                        margin: { t: 40, r: 10, l: 50, b: 40 },
                        yaxis: { title: "Percentage (%)", rangemode: "tozero", range: [0, 100] },
                        showlegend: true,
                      }}
                      style={{ width: "100%", height: "360px" }}
                    />
                  </div>
                ) : <p className="text-muted-foreground">Run FPCA to see results.</p>}
              </TabsContent>

              {/* FPC loadings */}
              <TabsContent value="loadings" className="mt-4">
                {fpcaActive ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <Label>Select a FPC:</Label>
                          <Select
                            value={String(loadingIndex)}
                            onValueChange={(v) => setLoadingIndex(parseInt(v))}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {fpcaActive.components.map((_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  {`FPC ${i + 1}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label>Perturbation (× SD of scores):</Label>
                          <div className="w-64">
                            <Slider
                              value={[perturb]}
                              min={0}
                              max={2}
                              step={0.1}
                              onValueChange={(v) => setPerturb(v[0])}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {perturb.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Loading function */}
                        <ClientPlot
                          data={[
                            {
                              x: domainX,
                              y: fpcaActive.components[loadingIndex],
                              type: "scatter",
                              mode: "lines",
                              line: { color: "#1f77b4" },
                            } as any,
                          ]}
                          layout={{
                            title: `Loading function (FPC ${loadingIndex + 1})`,
                            margin: { t: 40, r: 10, l: 45, b: 40 },
                            xaxis: { title: "X" },
                            yaxis: { title: "Loading" },
                          }}
                          style={{ width: "100%", height: "360px" }}
                        />

                        {/* Perturbation of the mean */}
                        <ClientPlot
                          data={[
                            {
                              x: domainX,
                              y: meanFunction,
                              type: "scatter",
                              mode: "lines",
                              line: { color: "black" },
                              name: "Mean",
                            } as any,
                            {
                              x: domainX,
                              y: domainX.map(
                                (_, j) =>
                                  meanFunction[j] +
                                  perturb *
                                    (fpcaActive.scores.reduce(
                                      (s, r) => s + r[loadingIndex] ** 2,
                                      0
                                    ) /
                                      (fpcaActive.scores.length - 1)) **
                                      0.5 *
                                    fpcaActive.components[loadingIndex][j]
                              ),
                              type: "scatter",
                              mode: "markers",
                              marker: { color: "blue", symbol: "cross" },
                              name: "+ perturb",
                            } as any,
                            {
                              x: domainX,
                              y: domainX.map(
                                (_, j) =>
                                  meanFunction[j] -
                                  perturb *
                                    (fpcaActive.scores.reduce(
                                      (s, r) => s + r[loadingIndex] ** 2,
                                      0
                                    ) /
                                      (fpcaActive.scores.length - 1)) **
                                      0.5 *
                                    fpcaActive.components[loadingIndex][j]
                              ),
                              type: "scatter",
                              mode: "lines",
                              line: { color: "red", dash: "dash" },
                              name: "- perturb",
                            } as any,
                          ]}
                          layout={{
                            title: "Perturbation of the mean",
                            margin: { t: 40, r: 10, l: 45, b: 40 },
                            showlegend: true,
                            xaxis: { title: "X" },
                            yaxis: { title: "Y" },
                          }}
                          style={{ width: "100%", height: "360px" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Run FPCA to see results.</p>
                  )}
                </TabsContent>

                {/* FPC scores */}
                <TabsContent value="scores" className="mt-4">
                  {fpcaActive ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Choose the X-axis:</Label>
                          <Select value={xAxisChoice} onValueChange={setXAxisChoice}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {axisXOptions.map((name, i) => (
                                <SelectItem key={i} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Choose the Y-axis:</Label>
                          <Select value={yAxisChoice} onValueChange={setYAxisChoice}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {axisYOptions.map((name, i) => (
                                <SelectItem key={i} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedIdx.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <Label>Selection Control:</Label>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedIdx([])
                                setSelectionRect(null)
                                setSelectionLocked(false)
                                setRawSelectionData(null)
                                setSelectionRevision((r) => r + 1)
                              }}
                            >
                              Clear Selection ({selectedIdx.length} points)
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Scatter Plot with correlation */}
                        <ClientPlot
                          ref={leftPlotRef}
                          data={[
                            {
                              x: getAxisData(xAxisChoice).valuesNum,
                              y: getAxisData(yAxisChoice).valuesNum,
                              type: "scatter",
                              mode: "markers",
                              marker: { color: "#1f77b4", size: 8 },
                              // Persist visual selection in the scatter
                              selectedpoints: selectedIdx as any,
                              selected: { marker: { color: "#FF4500", size: 9 } } as any,
                              unselected: { marker: { opacity: 0.35 } } as any,
                            } as any,
                          ]}
                          layout={{
                            title: "Scores scatter plot",
                            margin: { t: 40, r: 10, l: 45, b: 40 },
                            selectionrevision: selectionRevision,
                            shapes: selectionRect
                              ? [
                                  {
                                    type: "rect",
                                    xref: "x",
                                    yref: "y",
                                    x0: Math.min(selectionRect.x0, selectionRect.x1),
                                    x1: Math.max(selectionRect.x0, selectionRect.x1),
                                    y0: Math.min(selectionRect.y0, selectionRect.y1),
                                    y1: Math.max(selectionRect.y0, selectionRect.y1),
                                    line: { color: "#FF4500", width: 2 },
                                    fillcolor: "rgba(255,69,0,0.08)",
                                  } as any,
                                ]
                              : [],
                            annotations: [
                              {
                                x: 1,
                                y: 0,
                                xref: "paper",
                                yref: "paper",
                                text: `<b>Pearson's correlation = ${pearson(
                                  getAxisData(xAxisChoice).valuesNum || [],
                                  getAxisData(yAxisChoice).valuesNum || []
                                ).toFixed(3)}</b>`,
                                showarrow: false,
                                font: { size: 12, color: "red" },
                                xanchor: "right",
                                yanchor: "bottom",
                              },
                            ],
                            dragmode: "select",
                          }}
                          config={{ 
                            displayModeBar: true, 
                            displaylogo: false,
                            doubleClick: 'reset+autosize',
                            doubleClickDelay: 300
                          }}
                          onSelected={(event: any) => {
                            // Store selection data immediately
                            try {
                              const points = event?.points || []
                              const indices = points.map((p: any) => p.pointIndex ?? p.pointNumber).filter((i: any) => typeof i === 'number')
                              
                              if (indices.length > 0) {
                                setRawSelectionData({ indices, event })
                                setSelectedIdx(indices)
                                setSelectionLocked(true)
                                
                                // For box selection, persist the selection rectangle
                                if (event?.range?.x && event?.range?.y) {
                                  setSelectionRect({
                                    x0: event.range.x[0],
                                    x1: event.range.x[1],
                                    y0: event.range.y[0],
                                    y1: event.range.y[1]
                                  })
                                } else {
                                  setSelectionRect(null)
                                }
                                setSelectionRevision((r) => r + 1)
                              }
                            } catch (error) {
                              console.warn('Selection error:', error)
                            }
                          }}
                          onDeselect={() => {
                            // Ignore automatic deselection when locked
                            if (!selectionLocked) {
                              setSelectedIdx([])
                              setSelectionRect(null)
                              setRawSelectionData(null)
                              setSelectionRevision((r) => r + 1)
                            }
                          }}
                          onDoubleClick={() => {
                            setSelectedIdx([])
                            setSelectionRect(null)
                            setSelectionLocked(false)
                            setRawSelectionData(null)
                            setSelectionRevision((r) => r + 1)
                          }}
                          style={{ width: "100%", height: "380px" }}
                        />

                        {/* Curves plot with highlight */}
                        <ClientPlot
                          key={`curves-${selectedIdx.join(',')}`}
                          data={functionalDataset.data.map((curve, i) => ({
                            x: domainX,
                            y: curve,
                            type: "scatter",
                            mode: "lines",
                            line: {
                              width: selectedIdx.includes(i) ? 3 : 1.5,
                              color: selectedIdx.includes(i) ? "#FF4500" : "rgba(70,130,180,0.35)",
                            },
                            name: `Curve ${i + 1}`,
                          }))}
                          layout={{
                            title: "Curves",
                            margin: { t: 40, r: 10, l: 45, b: 40 },
                            showlegend: false,
                          }}
                          style={{ width: "100%", height: "380px" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Run FPCA to see results.</p>
                  )}
                </TabsContent>

                {/* Reconstruction */}
                <TabsContent value="recon" className="mt-4">
                  {fpcaActive ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label>Select a curve:</Label>
                          <Select
                            value={String(reconCurveIndex)}
                            onValueChange={(v) => setReconCurveIndex(parseInt(v))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {functionalDataset.data.map((_, i) => (
                                <SelectItem key={i} value={String(i)}>
                                  Curve {i + 1}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>FPCs to be used:</Label>
                          <Slider
                            value={[reconNFPC]}
                            min={1}
                            max={nFPC}
                            step={1}
                            onValueChange={(v) => setReconNFPC(v[0])}
                          />
                          <span className="text-sm text-muted-foreground">
                            {reconNFPC}
                          </span>
                        </div>
                      </div>

                      <ClientPlot
                        data={[
                          {
                            x: domainX,
                            y: functionalDataset.data[reconCurveIndex],
                            type: "scatter",
                            mode: "lines",
                            line: { color: "#1f77b4" },
                            name: "Original",
                          } as any,
                          {
                            x: domainX,
                            y: reconCurve || [],
                            type: "scatter",
                            mode: "lines",
                            line: { dash: "dot", color: "red" },
                            name: "Reconstructed",
                          } as any,
                        ]}
                        layout={{
                          title: `Reconstruction with ${reconNFPC} FPCs`,
                          margin: { t: 40, r: 10, l: 45, b: 40 },
                          showlegend: true,
                        }}
                        style={{ width: "100%", height: "380px" }}
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Run FPCA to see results.</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}

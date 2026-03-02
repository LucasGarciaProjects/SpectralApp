"use client";

/**
 * Componente de Media y Desviación Estándar Funcional
 * 
 * Este componente calcula y visualiza las funciones de media y desviación estándar
 * para un dataset funcional. Incluye bandas de ±1 desviación estándar alrededor
 * de la media.
 */

import React, { useMemo } from "react";
import ClientPlot from "@/components/common/ClientPlot";
import { FunctionalDataset } from '@/hooks/useAppState'
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface MeanStdFunctionProps {
  functionalDataset: FunctionalDataset;
}

export default function MeanStdFunction({ functionalDataset }: MeanStdFunctionProps) {
  if (!functionalDataset) {
    return <p className="text-muted-foreground">No dataset selected</p>;
  }

  const { mean, std, lower, upper, x } = useMemo(() => {
    const data = functionalDataset.data;
    const n = data.length;
    const p = data[0].length;

    const mean: number[] = new Array(p).fill(0);
    const std: number[] = new Array(p).fill(0);

    // Calcular la media
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += data[i][j];
      mean[j] = sum / n;
    }

    // Calcular desviación estándar
    for (let j = 0; j < p; j++) {
      let sumSq = 0;
      for (let i = 0; i < n; i++) sumSq += (data[i][j] - mean[j]) ** 2;
      std[j] = Math.sqrt(sumSq / (n - 1));
    }

    const lower = mean.map((m, j) => m - std[j]);
    const upper = mean.map((m, j) => m + std[j]);
    const x = Array.from({ length: p }, (_, j) => j + 1);

    return { mean, std, lower, upper, x };
  }, [functionalDataset]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Mean & Standard Deviation — {functionalDataset.label}</h3>
        <button
          onClick={() => {
            const rows = x.map((xi, j) => `${xi},${mean[j]},${lower[j]},${upper[j]}`).join("\n");
            const blob = new Blob([`x,mean,lower,upper\n${rows}`], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${functionalDataset.label}_mean_std.csv`;
            a.click();
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          Download CSV
        </button>
      </div>
      <ClientPlot
        data={[
          {
            x,
            y: mean,
            type: "scatter",
            mode: "lines",
            name: "Mean",
            line: { color: "blue" },
          },
          {
            x,
            y: lower,
            type: "scatter",
            mode: "lines",
            name: "-1 SD",
            line: { color: "gray", dash: "dot" },
          },
          {
            x,
            y: upper,
            type: "scatter",
            mode: "lines",
            name: "+1 SD",
            line: { color: "gray", dash: "dot" },
          },
        ]}
        layout={{
          margin: { t: 30, r: 20, l: 40, b: 40 },
          xaxis: { title: "Domain" },
          yaxis: { title: "Function value" },
          showlegend: true,
        }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
}

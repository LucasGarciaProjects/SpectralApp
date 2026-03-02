"use client";

import { FunctionalDataset } from '@/lib/types'
import React, { useMemo } from "react";
import ClientPlot from "@/components/common/ClientPlot";

interface CorrelationFunctionProps {
  functionalDataset: FunctionalDataset;
}

export default function CorrelationFunction({ functionalDataset }: CorrelationFunctionProps) {
  if (!functionalDataset) {
    return <p className="text-muted-foreground">No dataset selected</p>;
  }

  const { corrMatrix, x } = useMemo(() => {
    const data = functionalDataset.data;
    const n = data.length;
    const p = data[0].length;

    const mean = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      for (let i = 0; i < n; i++) mean[j] += data[i][j];
      mean[j] /= n;
    }

    const covMatrix: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) {
          covMatrix[j][k] += (data[i][j] - mean[j]) * (data[i][k] - mean[k]);
        }
      }
    }
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        covMatrix[j][k] /= n - 1;
      }
    }

    const corrMatrix: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        const denom = Math.sqrt(covMatrix[j][j] * covMatrix[k][k]);
        corrMatrix[j][k] = denom > 0 ? covMatrix[j][k] / denom : 0;
      }
    }

    const x = Array.from({ length: p }, (_, j) => j + 1);
    return { corrMatrix, x };
  }, [functionalDataset]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Bivariate Correlation — {functionalDataset.label}</h3>
        <button
          onClick={() => {
            const rows = corrMatrix.map((row) => row.join(",")).join("\n");
            const blob = new Blob([rows], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${functionalDataset.label}_correlation.csv`;
            a.click();
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          Download CSV
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ClientPlot
          data={[
            {
              z: corrMatrix,
              x,
              y: x,
              type: "surface",
              colorscale: "Viridis",
              zmin: -1,
              zmax: 1,
            },
          ]}
          layout={{
            margin: { t: 30, r: 0, l: 0, b: 30 },
            scene: { xaxis: { title: "Domain" }, yaxis: { title: "Domain" }, zaxis: { title: "Correlation" } },
          }}
          style={{ width: "100%", height: "400px" }}
        />
        <ClientPlot
          data={[
            {
              z: corrMatrix,
              x,
              y: x,
              type: "contour",
              colorscale: "Viridis",
              zmin: -1,
              zmax: 1,
              contours: { coloring: "heatmap" },
            },
          ]}
          layout={{
            margin: { t: 30, r: 20, l: 40, b: 40 },
            xaxis: { title: "Domain" },
            yaxis: { title: "Domain" },
          }}
          style={{ width: "100%", height: "400px" }}
        />
      </div>
    </div>
  );
}

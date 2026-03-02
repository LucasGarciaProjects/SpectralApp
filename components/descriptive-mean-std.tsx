"use client";

import { Card } from "@/components/ui/card";
import { PlotlyChart } from "@/components/plotly-chart";
import { useAppState } from "@/hooks/useAppState";
import * as fda from "@/lib/fda-algorithms";
import { useMemo } from "react";

export default function DescriptiveMeanStd() {
  const { functionalBases, selectedBaseIndex } = useAppState();
  const dataset = selectedBaseIndex !== null ? functionalBases[selectedBaseIndex] : null;

  const results = useMemo(() => {
    if (!dataset) return null;
    const curves = dataset.data; // matriz: [n_samples x n_points]
    const mean = fda.computeMeanFunction(curves);
    const std = fda.computeStdFunction(curves);
    return { mean, std, curves };
  }, [dataset]);

  if (!results) return <p>No dataset selected</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-2">Mean Function</h3>
        <PlotlyChart
          data={[
            {
              x: results.mean.x,
              y: results.mean.y,
              type: "scatter",
              mode: "lines",
              line: { color: "blue" },
              name: "Mean",
            },
            {
              x: results.mean.x,
              y: results.mean.y_upper,
              type: "scatter",
              mode: "lines",
              line: { color: "gray", dash: "dot" },
              name: "Mean + Std",
            },
            {
              x: results.mean.x,
              y: results.mean.y_lower,
              type: "scatter",
              mode: "lines",
              line: { color: "gray", dash: "dot" },
              name: "Mean - Std",
            },
          ]}
          layout={{
            autosize: true,
            margin: { t: 20, r: 20, l: 40, b: 40 },
            xaxis: { title: "Domain" },
            yaxis: { title: "Value" },
          }}
          style={{ width: "100%", height: "400px" }}
        />
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-2">Standard Deviation Function</h3>
        <PlotlyChart
          data={[
            {
              x: results.std.x,
              y: results.std.y,
              type: "scatter",
              mode: "lines",
              line: { color: "red" },
              name: "Std",
            },
          ]}
          layout={{
            autosize: true,
            margin: { t: 20, r: 20, l: 40, b: 40 },
            xaxis: { title: "Domain" },
            yaxis: { title: "Std" },
          }}
          style={{ width: "100%", height: "400px" }}
        />
      </Card>
    </div>
  );
}

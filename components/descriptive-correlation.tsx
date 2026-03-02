"use client";

import { Card } from "@/components/ui/card";
import { PlotlyChart } from "@/components/plotly-chart";
import { useAppState } from "@/hooks/useAppState";
import * as fda from "@/lib/fda-algorithms";
import { useMemo } from "react";

export default function DescriptiveCorrelation() {
  const { functionalBases, selectedBaseIndex } = useAppState();
  const dataset = selectedBaseIndex !== null ? functionalBases[selectedBaseIndex] : null;

  const result = useMemo(() => {
    if (!dataset) return null;
    const curves = dataset.data;
    return fda.computeCorrelationMatrix(curves);
  }, [dataset]);

  if (!result) return <p>No dataset selected</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-2">Surface plot</h3>
        <PlotlyChart
          data={[
            {
              z: result.values,
              x: result.x,
              y: result.y,
              type: "surface",
              colorscale: "RdBu",
              zmin: -1,
              zmax: 1,
            },
          ]}
          layout={{
            autosize: true,
            margin: { t: 20, r: 20, l: 40, b: 40 },
            scene: { xaxis: { title: "Domain" }, yaxis: { title: "Domain" }, zaxis: { title: "Correlation" } },
          }}
          style={{ width: "100%", height: "400px" }}
        />
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-2">Contour plot</h3>
        <PlotlyChart
          data={[
            {
              z: result.values,
              x: result.x,
              y: result.y,
              type: "contour",
              colorscale: "RdBu",
              zmin: -1,
              zmax: 1,
            },
          ]}
          layout={{
            autosize: true,
            margin: { t: 20, r: 20, l: 40, b: 40 },
            xaxis: { title: "Domain" },
            yaxis: { title: "Domain" },
          }}
          style={{ width: "100%", height: "400px" }}
        />
      </Card>
    </div>
  );
}

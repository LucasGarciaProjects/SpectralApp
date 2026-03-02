"use client";

/**
 * Componente ClientPlot para visualización con Plotly
 * 
 * Wrapper para react-plotly.js que carga dinámicamente para evitar problemas
 * de SSR. Este componente se renderiza exclusivamente en el cliente.
 */

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

// Carga dinámica sin SSR para evitar "self is not defined" en el servidor
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function ClientPlot(props: PlotParams) {
  // Este componente se renderiza solo en el cliente
  return <Plot {...props} />;
}

"use client";

/**
 * Vista de Regresión Escalar sobre Funcional (SoFR)
 * 
 * Este componente implementa la regresión escalar sobre datos funcionales
 * donde la variable respuesta es escalar y las covariables son funcionales.
 * Incluye visualizaciones de valores ajustados vs observados, residuos,
 * parámetro funcional y curvas funcionales.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ResponseUpload from "@/components/response-upload";
import { runSOFR } from "@/lib/techniques/supervised/sofr";
import { FunctionalDataset } from "@/hooks/useAppState";
import { Download } from "lucide-react";
import dynamic from "next/dynamic";

// Importación dinámica de Plotly para evitar problemas de SSR
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function SOFRView({ functionalDataset }: { functionalDataset?: FunctionalDataset }) {
  const [responseData, setResponseData] = useState<number[] | null>(null);
  const [nComponents, setNComponents] = useState(5);
  const [results, setResults] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  // Estado de selección para funcionalidad de box select
  const [selectedIdx, setSelectedIdx] = useState<number[]>([]);
  const [selectionRevision, setSelectionRevision] = useState<number>(0);
  const [selectionRect, setSelectionRect] = useState<
    { x0: number; x1: number; y0: number; y1: number } | null
  >(null);
  const [selectionLocked, setSelectionLocked] = useState<boolean>(false);
  const [rawSelectionData, setRawSelectionData] = useState<any>(null);
  const plotRef = useRef<any>(null);

  // Maintain selection persistence
  useEffect(() => {
    if (rawSelectionData && selectionLocked) {
      // Force update the plot with persistent selection
      const plotElement = plotRef.current
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

  const handleRun = async () => {
    if (!functionalDataset || !responseData) return;
    
    setIsRunning(true);
    try {
      const res = await runSOFR(functionalDataset.data, responseData, {
        nComponents,
        center: true,
        scaleScores: false,
      });
      setResults(res);
    } catch (error) {
      console.error("Error running SOFR:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const downloadFittedValues = () => {
    if (!results || !responseData) return;
    
    const csvContent = [
      "Observed,Fitted,Residuals",
      ...responseData.map((obs, i) => 
        `${obs},${results.predictions[i]},${results.residuals[i]}`
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sofr_fitted_values.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBetaFunction = () => {
    if (!results?.extras?.functionalParameter) return;
    
    const { domain, beta, lower, upper } = results.extras.functionalParameter;
    const csvContent = [
      "Domain,Beta(t),Lower_CI,Upper_CI",
      ...domain.map((d, i) => 
        `${d},${beta[i]},${lower[i]},${upper[i]}`
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sofr_beta_function.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Response Variable (Continuous)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseUpload purpose="regression" onLoaded={(data) => setResponseData(data)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scalar-on-Function Regression Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium">Number of Components</label>
              <input
                type="number"
                value={nComponents}
                onChange={(e) => setNComponents(parseInt(e.target.value))}
                className="border rounded p-2 ml-2 w-20"
                min={1}
                max={12}
              />
            </div>
            <Button 
              onClick={handleRun} 
              disabled={!responseData || !functionalDataset || isRunning}
              className="mt-6"
            >
              {isRunning ? "Running Analysis..." : "Run SOFR Analysis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>SOFR Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Summary Fitted Model</TabsTrigger>
                <TabsTrigger value="fitted">Fitted Values & Residuals</TabsTrigger>
                <TabsTrigger value="functional">Functional Parameter</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Model Coefficients</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variable</TableHead>
                          <TableHead>Estimate</TableHead>
                          <TableHead>Std Error</TableHead>
                          <TableHead>t-value</TableHead>
                          <TableHead>p-value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Intercept</TableCell>
                          <TableCell>{isNaN(results.intercept) ? "–" : results.intercept.toFixed(4)}</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                        </TableRow>
                        {results.coefficients.map((coef: number, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">FPC {i + 1}</TableCell>
                            <TableCell>{isNaN(coef) ? "–" : coef.toFixed(4)}</TableCell>
                            <TableCell>{results.stderr?.[i + 1] && !isNaN(results.stderr[i + 1]) ? results.stderr[i + 1].toFixed(4) : "–"}</TableCell>
                            <TableCell>{results.tvalues?.[i + 1] && !isNaN(results.tvalues[i + 1]) ? results.tvalues[i + 1].toFixed(4) : "–"}</TableCell>
                            <TableCell>{results.pvalues?.[i + 1] && !isNaN(results.pvalues[i + 1]) ? results.pvalues[i + 1].toFixed(4) : "–"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Model Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>R²:</span>
                          <Badge variant="outline">{isNaN(results.metrics.r2) ? "–" : results.metrics.r2.toFixed(4)}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Adjusted R²:</span>
                          <Badge variant="outline">{results.metrics.adjR2 && !isNaN(results.metrics.adjR2) ? results.metrics.adjR2.toFixed(4) : "–"}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>RMSE:</span>
                          <Badge variant="outline">{isNaN(results.metrics.rmse) ? "–" : results.metrics.rmse.toFixed(4)}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Sample Size:</span>
                          <Badge variant="outline">{responseData?.length || 0}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fitted" className="space-y-4">
                {/* Selection Controls */}
                {selectedIdx.length > 0 && (
                  <div className="flex flex-col gap-2 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold">Selection Control:</h4>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Observed vs Fitted Values</h4>
                    <Plot
                      ref={plotRef}
                      data={[{
                        x: results.predictions,
                        y: responseData,
                        type: 'scatter',
                        mode: 'markers',
                        name: 'Data Points',
                        marker: { color: 'blue', size: 6 },
                        selectedpoints: selectedIdx,
                        selected: { marker: { color: '#FF4500', size: 9 } },
                        unselected: { marker: { opacity: 0.35 } }
                      }, {
                        x: [Math.min(...results.predictions), Math.max(...results.predictions)],
                        y: [Math.min(...results.predictions), Math.max(...results.predictions)],
                        type: 'scatter',
                        mode: 'lines',
                        name: 'Identity Line',
                        line: { color: 'red', dash: 'dash' }
                      }]}
                      layout={{
                        title: 'Observed vs Fitted Values',
                        xaxis: { title: 'Fitted Values' },
                        yaxis: { title: 'Observed Values' },
                        showlegend: true,
                        width: 400,
                        height: 300,
                        dragmode: "select",
                        selectionrevision: selectionRevision,
                        shapes: selectionRect ? [{
                          type: 'rect',
                          xref: 'x',
                          yref: 'y',
                          x0: selectionRect.x0,
                          x1: selectionRect.x1,
                          y0: selectionRect.y0,
                          y1: selectionRect.y1,
                          fillcolor: 'rgba(255, 69, 0, 0.1)',
                          line: { color: '#FF4500', width: 2 }
                        }] : []
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
                    />
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Residuals vs Fitted Values</h4>
                    <Plot
                      data={[{
                        x: results.predictions,
                        y: results.residuals,
                        type: 'scatter',
                        mode: 'markers',
                        name: 'Residuals',
                        marker: { color: 'green', size: 6 }
                      }]}
                      layout={{
                        title: 'Residuals vs Fitted Values',
                        xaxis: { title: 'Fitted Values' },
                        yaxis: { title: 'Residuals' },
                        showlegend: true,
                        width: 400,
                        height: 300
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Functional Curves</h4>
                  <div className="h-80">
                    <Plot
                      key={`curves-${selectedIdx.join(',')}`}
                      data={functionalDataset?.data.map((curve, i) => ({
                        x: functionalDataset.timePoints || Array.from({ length: curve.length }, (_, j) => j),
                        y: curve,
                        type: 'scatter',
                        mode: 'lines',
                        name: `Curve ${i + 1}`,
                        line: { 
                          color: selectedIdx.includes(i) ? "#FF4500" : "rgba(70,130,180,0.35)",
                          width: selectedIdx.includes(i) ? 3 : 1.5
                        },
                        opacity: selectedIdx.includes(i) ? 1 : 0.7
                      })) || []}
                      layout={{
                        title: 'Functional Curves (Orange: Selected)',
                        xaxis: { title: 'Time' },
                        yaxis: { title: 'Value' },
                        margin: { t: 40, r: 10, l: 50, b: 40 },
                        showlegend: false
                      }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="functional" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Functional Parameter β(t)</h4>
                  <div className="h-80">
                    <Plot
                      data={[{
                        x: results.extras.functionalParameter.domain,
                        y: results.extras.functionalParameter.beta,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'β(t)',
                        line: { color: 'blue', width: 2 }
                      }, {
                        x: results.extras.functionalParameter.domain,
                        y: results.extras.functionalParameter.upper,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'Upper 95% CI',
                        line: { color: 'red', width: 1, dash: 'dash' },
                        showlegend: false
                      }, {
                        x: results.extras.functionalParameter.domain,
                        y: results.extras.functionalParameter.lower,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'Lower 95% CI',
                        line: { color: 'red', width: 1, dash: 'dash' },
                        fill: 'tonexty',
                        fillcolor: 'rgba(255,0,0,0.1)'
                      }]}
                      layout={{
                        title: 'Functional Parameter β(t) with 95% Confidence Intervals',
                        xaxis: { title: 'Time' },
                        yaxis: { title: 'β(t)' },
                        margin: { t: 40, r: 10, l: 50, b: 40 },
                        showlegend: true
                      }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* Download Buttons */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadFittedValues}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Fitted Values (CSV)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadBetaFunction}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Beta Function (CSV)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

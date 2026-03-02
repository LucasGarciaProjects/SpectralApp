"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ResponseUpload from "@/components/response-upload";
import { runFOFR } from "@/lib/techniques/supervised/fofr";
import { FunctionalDataset } from "@/hooks/useAppState";
import dynamic from "next/dynamic";

// Dynamic import for Plotly to avoid SSR issues
const Plot = dynamic(() => import("@/components/common/ClientPlot"), { ssr: false });

export default function FOFRView({ functionalDataset }: { functionalDataset?: FunctionalDataset }) {
  const [responseData, setResponseData] = useState<number[] | null>(null);
  const [nComponents, setNComponents] = useState(5);
  const [results, setResults] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    if (!functionalDataset || !responseData) return;
    
    setIsRunning(true);
    try {
      const res = await runFOFR(functionalDataset.data, responseData, {
        nComponents,
        center: true,
        scaleScores: false,
      });
      setResults(res);
    } catch (error) {
      console.error("Error running FOFR:", error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Response Variable (Functional)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseUpload purpose="regression" onLoaded={(data) => setResponseData(data)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Function-on-Function Regression Configuration</CardTitle>
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
              {isRunning ? "Running Analysis..." : "Run FOFR Analysis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>FOFR Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary Fitted Model</TabsTrigger>
                <TabsTrigger value="fitted">Fitted Functions</TabsTrigger>
                <TabsTrigger value="residuals">Residual Analysis</TabsTrigger>
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
                            <TableCell>{results.stderr?.[i] && !isNaN(results.stderr[i]) ? results.stderr[i].toFixed(4) : "–"}</TableCell>
                            <TableCell>{results.tvalues?.[i] && !isNaN(results.tvalues[i]) ? results.tvalues[i].toFixed(4) : "–"}</TableCell>
                            <TableCell>{results.pvalues?.[i] && !isNaN(results.pvalues[i]) ? results.pvalues[i].toFixed(4) : "–"}</TableCell>
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
                <div>
                  <h4 className="font-semibold mb-2">Fitted Functions vs Observed Functions</h4>
                  <Plot
                    data={[
                      // Observed functions
                      ...functionalDataset?.data.map((curve, i) => ({
                        x: functionalDataset?.timePoints || Array.from({ length: curve.length }, (_, j) => j),
                        y: curve,
                        type: 'scatter',
                        mode: 'lines',
                        name: `Observed ${i + 1}`,
                        line: { color: 'blue', width: 1, dash: 'solid' },
                        opacity: 0.7
                      })) || [],
                      // Fitted functions (if available)
                      ...(results.extras?.fittedFunctionalResponses?.map((fittedCurve: number[], i: number) => ({
                        x: functionalDataset?.timePoints || Array.from({ length: fittedCurve.length }, (_, j) => j),
                        y: fittedCurve,
                        type: 'scatter',
                        mode: 'lines',
                        name: `Fitted ${i + 1}`,
                        line: { color: 'red', width: 2, dash: 'dash' },
                        opacity: 0.8
                      })) || [])
                    ]}
                    layout={{
                      title: 'Fitted Functions vs Observed Functions (Blue: Observed, Red: Fitted)',
                      xaxis: { title: 'Time' },
                      yaxis: { title: 'Value' },
                      showlegend: false,
                      width: 800,
                      height: 400
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="residuals" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Residual Functions</h4>
                    <Plot
                      data={results.extras?.residualFunctions?.map((residualCurve: number[], i: number) => ({
                        x: functionalDataset?.timePoints || Array.from({ length: residualCurve.length }, (_, j) => j),
                        y: residualCurve,
                        type: 'scatter',
                        mode: 'lines',
                        name: `Residuals ${i + 1}`,
                        line: { color: 'green', width: 1 },
                        opacity: 0.7
                      })) || []}
                      layout={{
                        title: 'Residual Functions',
                        xaxis: { title: 'Time' },
                        yaxis: { title: 'Residual Value' },
                        showlegend: false,
                        width: 400,
                        height: 300
                      }}
                    />
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Residual Distribution</h4>
                    <Plot
                      data={[{
                        x: results.residuals,
                        type: 'histogram',
                        name: 'Residuals',
                        marker: { color: 'blue', opacity: 0.7 }
                      }]}
                      layout={{
                        title: 'Distribution of Residuals',
                        xaxis: { title: 'Residual Value' },
                        yaxis: { title: 'Frequency' },
                        showlegend: true,
                        width: 400,
                        height: 300
                      }}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="functional" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Functional Parameter β(t)</h4>
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
                      showlegend: true,
                      width: 800,
                      height: 400
                    }}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

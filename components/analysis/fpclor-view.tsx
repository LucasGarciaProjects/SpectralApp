"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import ResponseUpload from "@/components/response-upload";
import { runFPCLoR } from "@/lib/techniques/supervised/fpclor";
import { FunctionalDataset } from "@/hooks/useAppState";
import dynamic from "next/dynamic";

// Dynamic import for Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function FPCLoRView({ functionalDataset }: { functionalDataset?: FunctionalDataset }) {
  const [responseData, setResponseData] = useState<number[] | null>(null);
  const [nComponents, setNComponents] = useState(5);
  const [results, setResults] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [cutoff, setCutoff] = useState(0.5);

  const handleRun = async () => {
    if (!functionalDataset || !responseData) return;
    
    setIsRunning(true);
    try {
      const res = await runFPCLoR(functionalDataset.data, responseData, {
        nComponents,
        center: true,
        scaleScores: false,
      });
      setResults(res);
    } catch (error) {
      console.error("Error running FPCLoR:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const confusionMatrix = results?.extras?.confusionAt?.(cutoff) || { TP: 0, FP: 0, TN: 0, FN: 0 };
  const total = confusionMatrix.TP + confusionMatrix.FP + confusionMatrix.TN + confusionMatrix.FN;
  const ccr = total > 0 ? (confusionMatrix.TP + confusionMatrix.TN) / total : 0;
  const tpr = (confusionMatrix.TP + confusionMatrix.FN) > 0 ? confusionMatrix.TP / (confusionMatrix.TP + confusionMatrix.FN) : 0;
  const tnr = (confusionMatrix.TN + confusionMatrix.FP) > 0 ? confusionMatrix.TN / (confusionMatrix.TN + confusionMatrix.FP) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Response Variable (Binary 0/1)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseUpload purpose="classification" onLoaded={(data) => setResponseData(data)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classification Configuration</CardTitle>
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
              {isRunning ? "Running Analysis..." : "Run Classification Analysis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>FPCLoR Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary Fitted Model</TabsTrigger>
                <TabsTrigger value="roc">ROC Curve</TabsTrigger>
                <TabsTrigger value="fitted">Fitted Values & Classification</TabsTrigger>
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
                          <TableHead>z-value</TableHead>
                          <TableHead>p-value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Intercept</TableCell>
                          <TableCell>{isNaN(results.intercept) ? "–" : results.intercept.toFixed(4)}</TableCell>
                          <TableCell>{results.stderr?.[0] && !isNaN(results.stderr[0]) ? results.stderr[0].toFixed(4) : "–"}</TableCell>
                          <TableCell>{results.tvalues?.[0] && !isNaN(results.tvalues[0]) ? results.tvalues[0].toFixed(4) : "–"}</TableCell>
                          <TableCell>{results.pvalues?.[0] && !isNaN(results.pvalues[0]) ? results.pvalues[0].toFixed(4) : "–"}</TableCell>
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
                          <span>Log-likelihood:</span>
                          <Badge variant="outline">{results.metrics.logLikelihood && !isNaN(results.metrics.logLikelihood) ? results.metrics.logLikelihood.toFixed(4) : "–"}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>AIC:</span>
                          <Badge variant="outline">{results.metrics.aic && !isNaN(results.metrics.aic) ? results.metrics.aic.toFixed(4) : "–"}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Accuracy:</span>
                          <Badge variant="outline">{isNaN(results.metrics.accuracy) ? "–" : results.metrics.accuracy.toFixed(4)}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Log Loss:</span>
                          <Badge variant="outline">{isNaN(results.metrics.logLoss) ? "–" : results.metrics.logLoss.toFixed(4)}</Badge>
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

              <TabsContent value="roc" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">ROC Curve</h4>
                  <div className="h-80">
                    <Plot
                      data={[
                        {
                          x: results.extras.roc.fpr,
                          y: results.extras.roc.tpr,
                          type: "scatter",
                          mode: "lines",
                          name: "ROC Curve",
                          line: { color: "blue", width: 2 }
                        },
                        {
                          x: [0, 1],
                          y: [0, 1],
                          type: "scatter",
                          mode: "lines",
                          name: "Random Classifier",
                          line: { color: "red", dash: "dash" }
                        }
                      ]}
                      layout={{
                        title: `ROC Curve (AUC = ${results.extras.roc?.auc && !isNaN(results.extras.roc.auc) ? results.extras.roc.auc.toFixed(4) : "N/A"})`,
                        xaxis: { title: "False Positive Rate" },
                        yaxis: { title: "True Positive Rate" },
                        margin: { t: 40, r: 10, l: 50, b: 40 }
                      }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fitted" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Predicted Probabilities</h4>
                    <div className="h-80">
                      <Plot
                        data={[
                          {
                            x: Array.from({ length: results.proba.length }, (_, i) => i + 1),
                            y: results.proba,
                            type: "scatter",
                            mode: "markers",
                            name: "Probabilities",
                            marker: { 
                              color: responseData?.map((y, i) => y === 1 ? "red" : "blue") || "blue",
                              size: 6
                            }
                          },
                          {
                            x: [1, results.proba.length],
                            y: [cutoff, cutoff],
                            type: "scatter",
                            mode: "lines",
                            name: "Cutoff",
                            line: { color: "green", dash: "dash", width: 2 }
                          }
                        ]}
                        layout={{
                          title: "Predicted Probabilities (Red: Class 1, Blue: Class 0)",
                          xaxis: { title: "Sample Index" },
                          yaxis: { title: "Probability" },
                          margin: { t: 40, r: 10, l: 50, b: 40 }
                        }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Confusion Matrix</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium">Cutoff:</label>
                        <Slider
                          value={[cutoff]}
                          onValueChange={(value) => setCutoff(value[0])}
                          max={1}
                          min={0}
                          step={0.1}
                          className="w-32"
                        />
                        <span className="text-sm font-mono">{cutoff.toFixed(1)}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 max-w-xs">
                        <div className="text-center p-2 border rounded">
                          <div className="text-2xl font-bold text-green-600">{confusionMatrix.TN}</div>
                          <div className="text-xs">True Negative</div>
                        </div>
                        <div className="text-center p-2 border rounded">
                          <div className="text-2xl font-bold text-red-600">{confusionMatrix.FP}</div>
                          <div className="text-xs">False Positive</div>
                        </div>
                        <div className="text-center p-2 border rounded">
                          <div className="text-2xl font-bold text-red-600">{confusionMatrix.FN}</div>
                          <div className="text-xs">False Negative</div>
                        </div>
                        <div className="text-center p-2 border rounded">
                          <div className="text-2xl font-bold text-green-600">{confusionMatrix.TP}</div>
                          <div className="text-xs">True Positive</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>CCR (Accuracy):</span>
                          <Badge variant="outline">{ccr.toFixed(4)}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>TPR (Sensitivity):</span>
                          <Badge variant="outline">{tpr.toFixed(4)}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>TNR (Specificity):</span>
                          <Badge variant="outline">{tnr.toFixed(4)}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="functional" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Functional Parameter β(t)</h4>
                  <div className="h-80">
                    <Plot
                      data={[
                        {
                          x: Array.from({ length: results.extras.functionalParameter.beta.length }, (_, i) => i),
                          y: results.extras.functionalParameter.beta,
                          type: "scatter",
                          mode: "lines",
                          name: "β(t)",
                          line: { color: "blue", width: 2 }
                        },
                        {
                          x: Array.from({ length: results.extras.functionalParameter.upper.length }, (_, i) => i),
                          y: results.extras.functionalParameter.upper,
                          type: "scatter",
                          mode: "lines",
                          name: "Upper CI",
                          line: { color: "red", dash: "dash", width: 1 },
                          showlegend: false
                        },
                        {
                          x: Array.from({ length: results.extras.functionalParameter.lower.length }, (_, i) => i),
                          y: results.extras.functionalParameter.lower,
                          type: "scatter",
                          mode: "lines",
                          name: "Lower CI",
                          line: { color: "red", dash: "dash", width: 1 },
                          fill: "tonexty",
                          fillcolor: "rgba(255,0,0,0.1)"
                        }
                      ]}
                      layout={{
                        title: "Functional Parameter β(t) with 95% Confidence Intervals",
                        xaxis: { title: "Time" },
                        yaxis: { title: "β(t)" },
                        margin: { t: 40, r: 10, l: 50, b: 40 }
                      }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
"use client"

import { useState, useEffect } from 'react'
import { TrendingUp, Target, AlertTriangle, BarChart3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

import { RegressionLayout } from '@/components/analysis-layout'
import { useAppState } from '@/hooks/useAppState'
import ScalarUploadInline from '@/components/scalar-upload-inline'
import { getTechnique } from '@/lib/techniques/registry'
import type { TechniqueId } from '@/lib/techniques/registry'
import type { SupervisedResult } from '@/lib/techniques/types'
import type { FunctionalDataset } from '@/hooks/useAppState'

interface RegressionViewProps {
  onBack?: () => void
  functionalDataset?: FunctionalDataset
}

export function RegressionView({ onBack, functionalDataset }: RegressionViewProps) {
  const { functionalBases, selectedBaseIndex, scalarData } = useAppState()
  const activeDataset = selectedBaseIndex !== null ? functionalBases[selectedBaseIndex] : null
  const dataset = functionalDataset ?? activeDataset

  // Unificar ejecución con el registry
  const [techniqueId, setTechniqueId] = useState<TechniqueId>("fpcr") // "fpcr" | "fpclor"
  const [targetVariable, setTargetVariable] = useState<string>('')
  const [nComponents, setNComponents] = useState(5)
  const [alpha, setAlpha] = useState(1e-2)
  const [fitIntercept, setFitIntercept] = useState(true)
  const [center, setCenter] = useState(true)
  const [scaleScores, setScaleScores] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<SupervisedResult | null>(null)

  // Check if scalar data is available
  const hasScalarData = scalarData && scalarData.length > 0
  const numericColumns = hasScalarData 
    ? Object.keys(scalarData[0]).filter(key => 
        scalarData.every(row => typeof row[key] === 'number')
      )
    : []

  // Extract target vector from scalar data
  const yVector = hasScalarData && targetVariable 
    ? scalarData!.map(row => row[targetVariable] as number)
    : null

  const hasY = Array.isArray(yVector) && yVector.length > 0
  const canRunRegression = hasScalarData && targetVariable && dataset && yVector

  // Validación ligera: FPCLoR requiere y binaria 0/1
  const isBinary = (arr: number[]) => {
    const s = new Set(arr)
    return s.size <= 2 && [...s].every(v => v === 0 || v === 1)
  }

  useEffect(() => {
    if (techniqueId === "fpclor" && yVector && !isBinary(yVector)) {
      // notifica al usuario que debe mapear clases a 0/1
      console.warn("FPCLoR requires binary target values (0/1). Current values:", [...new Set(yVector)])
    }
  }, [techniqueId, yVector])

  const handleRunRegression = async () => {
    if (!canRunRegression || !dataset || !yVector) return
    
    setIsRunning(true)
    
    try {
      // Execute using registry
      const tech = getTechnique(techniqueId)
      const res: SupervisedResult = await tech.run(dataset.data, yVector, { 
        nComponents, 
        center, 
        scaleScores, 
        alpha, 
        fitIntercept 
      })
      setResult(res)
    } catch (error) {
      console.error('Regression computation failed:', error)
      // You could show a toast or error message here
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <RegressionLayout onBack={onBack}>
      <div className="space-y-6">
        {/* Prerequisites Check */}
        {!hasScalarData && <ScalarUploadInline purpose={techniqueId === "fpclor" ? "classification" : "regression"} />}

        {/* Requirements */}
        <div className="rounded-xl border p-3 bg-muted/20">
          <h4 className="font-medium">Requirements for this tool</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            <li>Functional curves dataset (already created in Functionalization).</li>
            <li>
              Scalar response dataset — {techniqueId === "fpclor" ? "binary (0/1) for logistic" : "continuous for FPCR"}.
              {!hasY && <span className="ml-1 text-amber-600">Not found — please upload below.</span>}
            </li>
          </ul>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Regression Configuration</CardTitle>
            <CardDescription>
              Configure functional {techniqueId === "fpcr" ? "regression (FPCR)" : "classification (FPCLoR)"} parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Analysis Type</Label>
                  <Select
                    value={techniqueId}
                    onValueChange={(value: TechniqueId) => setTechniqueId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fpcr">FPCR (Regression)</SelectItem>
                      <SelectItem value="fpclor">FPCLoR (Classification)</SelectItem>
                    </SelectContent>
                  </Select>
                  {techniqueId === "fpclor" && yVector && !isBinary(yVector) && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        FPCLoR requires binary target values (0/1). Current values: {[...new Set(yVector)].join(', ')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Target Variable</Label>
                  <Select
                    value={targetVariable}
                    onValueChange={setTargetVariable}
                    disabled={!hasScalarData}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={hasScalarData ? "Select target variable..." : "No scalar data available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {numericColumns.map((column) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasScalarData && (
                    <div className="text-xs text-muted-foreground">
                      Available numeric variables: {numericColumns.length}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Number of Components</Label>
                  <Select
                    value={nComponents.toString()}
                    onValueChange={(value) => setNComponents(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} component{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ridge Parameter (α): {alpha.toExponential(2)}</Label>
                  <Slider
                    value={[Math.log10(alpha)]}
                    onValueChange={([value]) => setAlpha(Math.pow(10, value))}
                    min={-5}
                    max={0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">
                    Regularization strength (smaller = less regularization)
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="center">Center Data</Label>
                    <Switch
                      id="center"
                      checked={center}
                      onCheckedChange={setCenter}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="scaleScores">Scale Scores</Label>
                    <Switch
                      id="scaleScores"
                      checked={scaleScores}
                      onCheckedChange={setScaleScores}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fitIntercept">Fit Intercept</Label>
                    <Switch
                      id="fitIntercept"
                      checked={fitIntercept}
                      onCheckedChange={setFitIntercept}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Data Summary</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded border">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Analysis Type:</span>
                        <Badge variant="outline">{techniqueId === "fpcr" ? "Regression" : "Classification"}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Functional Dataset:</span>
                        <Badge variant="outline">{dataset?.label}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Samples:</span>
                        <span className="font-mono">{dataset?.data.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Scalar Variables:</span>
                        <span className="font-mono">{numericColumns.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Target Selected:</span>
                        <span className={targetVariable ? "text-green-600" : "text-orange-600"}>
                          {targetVariable || 'None'}
                        </span>
                      </div>
                      {yVector && (
                        <div className="flex justify-between">
                          <span>Target Values:</span>
                          <span className="font-mono text-xs">{[...new Set(yVector)].slice(0, 5).join(', ')}{[...new Set(yVector)].length > 5 ? '...' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleRunRegression}
                  disabled={!canRunRegression || isRunning || (techniqueId === "fpclor" && yVector && !isBinary(yVector))}
                  className="w-full"
                >
                  {isRunning ? (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2 animate-spin" />
                      Running {techniqueId.toUpperCase()}...
                    </>
                  ) : (
                    <>
                      {techniqueId === "fpcr" ? <Target className="h-4 w-4 mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                      Run {techniqueId === "fpcr" ? "Regression" : "Classification"} Analysis
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Variables */}
        {hasScalarData && (
          <Card>
            <CardHeader>
              <CardTitle>Available Variables</CardTitle>
              <CardDescription>
                Scalar variables available for regression analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-3">
                {numericColumns.map((column) => (
                  <div 
                    key={column}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      targetVariable === column 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setTargetVariable(column)}
                  >
                    <div className="font-medium text-sm">{column}</div>
                    <div className="text-xs text-muted-foreground">
                      {scalarData?.length || 0} observations
                    </div>
                    {targetVariable === column && (
                      <Badge variant="secondary" size="sm" className="mt-1">
                        Selected Target
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result ? (
          <Card>
            <CardHeader>
              <CardTitle>{techniqueId === "fpcr" ? "Regression" : "Classification"} Results</CardTitle>
              <CardDescription>
                {techniqueId === "fpcr" ? "FPCR" : "FPCLoR"} analysis results with {nComponents} components
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Summary */}
              <div>
                <Label className="text-sm font-medium">Model Summary</Label>
                <div className="mt-2 grid gap-4 md:grid-cols-2">
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="text-sm font-medium">Model Parameters</div>
                    <div className="mt-2 space-y-1 text-xs">
                      <div>Components: {result.featurizer?.scores[0]?.length || nComponents}</div>
                      <div>Regularization (α): {alpha.toExponential(2)}</div>
                      <div>Intercept: {result.intercept?.toFixed(4) || 'N/A'}</div>
                      <div>Centered: {center ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="text-sm font-medium">Performance Metrics</div>
                    <div className="mt-2 space-y-1 text-xs">
                      {result.kind === "supervised:regression" && (
                        <>
                          <div>RMSE: {result.metrics?.rmse?.toFixed(4) || 'N/A'}</div>
                          <div>R²: {result.metrics?.r2?.toFixed(4) || 'N/A'}</div>
                        </>
                      )}
                      {result.kind === "supervised:classification" && (
                        <>
                          <div>Accuracy: {((result.metrics as any)?.accuracy * 100)?.toFixed(1) || 'N/A'}%</div>
                          <div>Log Loss: {(result.metrics as any)?.logLoss?.toFixed(4) || 'N/A'}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coefficients */}
              {result.coefficients && (
                <div>
                  <Label className="text-sm font-medium">Model Coefficients</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded border">
                    <div className="text-xs font-mono">
                      {result.coefficients.map((coef, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>PC{idx + 1}:</span>
                          <span>{coef.toFixed(4)}</span>
                        </div>
                      ))}
                      {result.intercept !== undefined && (
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span>Intercept:</span>
                          <span>{result.intercept.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Confusion Matrix for Classification */}
              {result.kind === "supervised:classification" && (result.metrics as any)?.confusion && (
                <div>
                  <Label className="text-sm font-medium">Confusion Matrix</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded border">
                    <div className="text-xs">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div></div>
                        <div className="font-medium">Pred 0</div>
                        <div className="font-medium">Pred 1</div>
                        <div className="font-medium">True 0</div>
                        <div className="font-mono">{(result.metrics as any).confusion[0][0]}</div>
                        <div className="font-mono">{(result.metrics as any).confusion[0][1]}</div>
                        <div className="font-medium">True 1</div>
                        <div className="font-mono">{(result.metrics as any).confusion[1][0]}</div>
                        <div className="font-mono">{(result.metrics as any).confusion[1][1]}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FPCA Information */}
              {result.featurizer && (
                <div>
                  <Label className="text-sm font-medium">Principal Component Analysis</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded border">
                    <div className="text-xs space-y-1">
                      <div>Components Used: {result.featurizer.scores[0]?.length || 0}</div>
                      {result.featurizer.explainedVariance && (
                        <div>Total Variance Explained: {result.featurizer.explainedVariance.reduce((sum, val) => sum + val, 0).toFixed(1)}%</div>
                      )}
                      <div>Samples: {result.featurizer.scores.length}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{techniqueId === "fpcr" ? "Regression" : "Classification"} Results</CardTitle>
              <CardDescription>
                Results will appear here after running the analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                {techniqueId === "fpcr" ? (
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                ) : (
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                )}
                <h3 className="text-lg font-medium mb-2">
                  {techniqueId === "fpcr" ? "FPCR Analysis" : "FPCLoR Analysis"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  Select a target variable and run the analysis to view results
                </p>
                <div className="text-xs text-muted-foreground max-w-md mx-auto">
                  {techniqueId === "fpcr" 
                    ? `Functional Principal Component Regression uses the first ${nComponents} principal components of the functional data to predict the target variable.`
                    : `Functional Principal Component Logistic Regression uses the first ${nComponents} principal components for binary classification.`
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Information */}
        <Card>
          <CardHeader>
            <CardTitle>About {techniqueId === "fpcr" ? "FPCR" : "FPCLoR"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              {techniqueId === "fpcr" ? (
                <>
                  <p>
                    • <strong>Functional Principal Component Regression (FPCR)</strong> uses functional principal components as predictors
                  </p>
                  <p>
                    • The method reduces dimensionality while preserving important variance in the functional data
                  </p>
                  <p>
                    • Ridge regularization prevents overfitting and handles multicollinearity
                  </p>
                  <p>
                    • Results include regression coefficients, RMSE, R², and model predictions
                  </p>
                </>
              ) : (
                <>
                  <p>
                    • <strong>Functional Principal Component Logistic Regression (FPCLoR)</strong> extends FPCR for binary classification
                  </p>
                  <p>
                    • Uses Newton-Raphson optimization with ridge regularization for logistic regression
                  </p>
                  <p>
                    • Requires binary target values (0/1) and produces probabilistic predictions
                  </p>
                  <p>
                    • Results include accuracy, log loss, confusion matrix, and class probabilities
                  </p>
                </>
              )}
              <p>
                • Both methods first apply FPCA to extract the most important functional features
              </p>
              <p>
                • Cross-validation can be used to select optimal hyperparameters (components, α)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </RegressionLayout>
  )
}
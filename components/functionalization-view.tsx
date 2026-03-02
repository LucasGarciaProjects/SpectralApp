/**
 * Componente de Vista de Funcionalización
 * 
 * Este componente gestiona la conversión de datos espectrales crudos en datos
 * funcionales usando varias funciones base (B-splines, Fourier, Wavelets). Proporciona:
 * - Configuración interactiva de parámetros para diferentes tipos de bases
 * - Visualización en tiempo real de resultados de funcionalización
 * - Evaluación de calidad y validación de datasets funcionales
 * - Gestión de datasets con funcionalidad de guardar/cargar/eliminar
 * - Optimización automática de parámetros usando GCV
 */

"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, Star, StarOff, TrendingUp, Download } from 'lucide-react'
import { PlotlyChart } from '@/components/plotly-chart'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useAppState, type FunctionalDataset } from '@/hooks/useAppState'
import { 
  functionalizeSpectrum, 
  functionalizeMatrix,
  apiAutoGCV,
  getRecommendedParams,
  getRuppertBasisCount,
  type BasisType,
  type FunctionalizationParams 
} from '@/lib/fda-algorithms'

interface FunctionalizationViewProps {
  onBack?: () => void
  onContinue?: () => void
}

export function FunctionalizationView({ onBack }: FunctionalizationViewProps) {
  const router = useRouter()
  const { 
    rawData, 
    domain, 
    functionalBases, 
    selectedBaseIndex,
    vizPrefs,
    addFunctionalDataset, 
    removeFunctionalDataset,
    selectFunctionalDataset,
    setVizPrefs
  } = useAppState()

  // Functionalization parameters
  const [basisType, setBasisType] = useState<BasisType>('bspline')
  const [nBasis, setNBasis] = useState(20)
  const [lambda, setLambda] = useState(0.1)
  const [datasetName, setDatasetName] = useState('')

  // Visualization preferences
  const [xAxisTitle, setXAxisTitle] = useState(vizPrefs.xAxisTitle)
  const [yAxisTitle, setYAxisTitle] = useState(vizPrefs.yAxisTitle)
  const [selectedSpectrumIndex, setSelectedSpectrumIndex] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [useRuppertDefault, setUseRuppertDefault] = useState(true)

  // Required data
  const hasRequiredData = !!rawData && !!domain?.isConfirmed
  const nPoints = domain?.nPoints || 0
  const nSpectra = rawData?.length || 0

  // Initialize parameters using Ruppert's rule for optimal basis count
  useEffect(() => {
    if (hasRequiredData && nPoints > 0 && useRuppertDefault) {
      const recommended = getRecommendedParams(nPoints, basisType)
      setNBasis(recommended.nBasis)
      setLambda(recommended.lambda)
      setUseRuppertDefault(false)
    }
  }, [hasRequiredData, nPoints, basisType, useRuppertDefault])

  // Update recommended when basis type changes
  useEffect(() => {
    if (hasRequiredData && nPoints > 0) {
      const recommended = getRecommendedParams(nPoints, basisType)
      setNBasis(recommended.nBasis)
      setLambda(recommended.lambda)
    }
  }, [basisType, hasRequiredData, nPoints])

  // Auto-generate dataset name
  useEffect(() => {
    const count = functionalBases.filter(d => d.method === basisType).length + 1
    setDatasetName(`${basisType.charAt(0).toUpperCase() + basisType.slice(1)} ${count}`)
  }, [basisType, functionalBases])

  // Wavelengths from domain (usa step real, evita redondeos)
  const wavelengths = useMemo(() => {
    if (!domain) return []
    const { startWavelength, nPoints, stepSize } = domain
    return Array.from({ length: nPoints }, (_, i) => startWavelength + i * stepSize)
  }, [domain])

  // Preview: single spectrum (para panel de métricas/descarga/curva seleccionada)
  const [previewResult, setPreviewResult] = useState<{
    fitted: number[]
    coefficients: number[]
    rmse: number
    r2: number
  } | null>(null)

  useEffect(() => {
    const updatePreview = async () => {
      if (!hasRequiredData || !rawData || rawData.length === 0) {
        setPreviewResult(null)
        return
      }
      try {
        const idx = selectedSpectrumIndex ?? 0
        if (idx >= nSpectra) {
          setPreviewResult(null)
          return
        }
        const spectrum = rawData[idx]
        const params: FunctionalizationParams = { basisType, nBasis, lambda, name: datasetName }
        const result = await functionalizeSpectrum(spectrum, wavelengths, params)
        setPreviewResult(result)
      } catch (err) {
        console.error('Functionalization preview error:', err)
        setPreviewResult(null) // si falla, seguimos con fitted global
      }
    }
    updatePreview()
  }, [hasRequiredData, rawData, selectedSpectrumIndex, basisType, nBasis, lambda, wavelengths, datasetName, nSpectra])

  // Fitted para todas las curvas + métricas globales
  const [fittedCurvesState, setFittedCurvesState] = useState<number[][]>([])
  const [globalMetrics, setGlobalMetrics] = useState<{rmse: number, r2: number} | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!rawData || !hasRequiredData || !domain) {
        setFittedCurvesState([])
        setGlobalMetrics(null)
        return
      }
      try {
        const params: FunctionalizationParams = { basisType, nBasis, lambda, name: 'temp_global' }
        const result = await functionalizeMatrix(rawData, domain, params)
        setGlobalMetrics(result.metrics)
        setFittedCurvesState(result.data)
      } catch (e) {
        console.error('Error updating fitted curves:', e)
        setFittedCurvesState([])
        setGlobalMetrics(null)
      }
    }
    run()
  }, [rawData, hasRequiredData, domain, basisType, nBasis, lambda])

  // Datos para residuals:
  // - None → residual medio por punto
  // - Seleccionada → residual de esa curva
  const residualSeries = useMemo(() => {
    if (!hasRequiredData || !rawData || rawData.length === 0 || wavelengths.length === 0) {
      return { x: [] as number[], y: [] as number[], label: '' }
    }

    if (selectedSpectrumIndex === null) {
      // residual medio
      if (fittedCurvesState.length !== rawData.length) {
        return { x: [], y: [], label: '' }
      }
      const M = wavelengths.length
      const N = rawData.length
      const meanResidual = new Array<number>(M).fill(0)
      for (let i = 0; i < N; i++) {
        const orig = rawData[i]
        const fit = fittedCurvesState[i]
        if (!orig || !fit || orig.length !== fit.length) return { x: [], y: [], label: '' }
        for (let j = 0; j < M; j++) {
          meanResidual[j] += (orig[j] - fit[j]) / N
        }
      }
      return { x: wavelengths, y: meanResidual, label: 'Mean residual' }
    } else {
      const idx = selectedSpectrumIndex
      if (idx >= rawData.length) return { x: [], y: [], label: '' }
      const original = rawData[idx]
      const fitted = previewResult?.fitted ?? (fittedCurvesState[idx] ?? [])
      if (!fitted || fitted.length !== original.length) return { x: [], y: [], label: '' }

      const residual = original.map((v, i) => v - fitted[i])
      return { x: wavelengths, y: residual, label: `Residual (curve ${idx + 1})` }
    }
  }, [hasRequiredData, rawData, fittedCurvesState, wavelengths, selectedSpectrumIndex, previewResult])

  // Curvas originales para comparación (siempre disponibles)
  const previewData = useMemo(() => {
    if (!hasRequiredData || !rawData || !domain) {
      return { curves: [] as number[][], x: [] as number[] }
    }
    return { curves: rawData, x: wavelengths }
  }, [hasRequiredData, rawData, domain, wavelengths])

  // Guardar dataset funcional (usa fitted global del backend)
  const handleSaveFunctionalDataset = async () => {
    if (!hasRequiredData || !domain || !rawData) return
    if (fittedCurvesState.length === 0) return

    setIsProcessing(true)
    try {
      const params: FunctionalizationParams = {
        basisType,
        nBasis,
        lambda,
        name: datasetName.trim() || `${basisType} Dataset`
      }
      const result = await functionalizeMatrix(rawData, domain, params)

      const newDataset: FunctionalDataset = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        label: params.name,
        method: basisType,
        data: result.data,
        parameters: {
          ...result.parameters,
          metrics: result.metrics
        }
      }
      addFunctionalDataset(newDataset)
    } catch (error) {
      console.error('Failed to save functional dataset:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Download the complete functionalized dataset with current parameters
  const handleDownloadData = () => {
    if (!hasRequiredData || !rawData || !domain) return
    
    // Check if we have fitted data for all curves
    if (fittedCurvesState.length === 0 || fittedCurvesState.length !== rawData.length) {
      console.warn("⚠️ No fitted data available to download")
      return
    }

    // Create CSV with all functionalized curves
    // Header: Wavelength, Curve1, Curve2, ..., CurveN
    const headers = ['Wavelength', ...Array.from({ length: rawData.length }, (_, i) => `Curve_${i + 1}`)]
    
    // Data rows: each wavelength with all fitted values
    const rows = wavelengths.map((w, i) => {
      const row = [w.toString()]
      fittedCurvesState.forEach(fittedCurve => {
        row.push(fittedCurve[i]?.toString() || '')
      })
      return row.join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(datasetName || 'dataset').replace(/\s+/g, '_')}_functionalized.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleProceedToAnalysis = () => {
    router.push('/analysis')
  }

  const handleSelectDataset = (index: number) => selectFunctionalDataset(index)
  const handleDeleteDataset = (datasetId: string) => removeFunctionalDataset(datasetId)

  if (!hasRequiredData) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Prerequisites Not Met
            </CardTitle>
            <CardDescription>
              Upload spectral data and configure domain before functionalization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Raw Data: {rawData ? '✅ Loaded' : '❌ Required'}</div>
              <div>Domain: {domain?.isConfirmed ? '✅ Configured' : '❌ Required'}</div>
            </div>
            <Button variant="outline" onClick={onBack} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Previous Step
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Functionalization</h1>
          <p className="text-muted-foreground">
            Transform raw spectral data into functional datasets
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {nSpectra} samples × {nPoints} points
          </Badge>
          <Badge variant="secondary">
            {functionalBases.length}/5 datasets
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Config */}
        <div className="lg:col-span-1 space-y-6">
          {/* Visualization — Curves section hidden as requested */}

          <Card>
            <CardHeader>
              <CardTitle>Parameters</CardTitle>
              <CardDescription>Configure functionalization parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="basis-type">Basis Type</Label>
                <Select value={basisType} onValueChange={(value: BasisType) => setBasisType(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bspline">B-spline</SelectItem>
                    <SelectItem value="fourier">Fourier</SelectItem>
                    <SelectItem value="wavelet">Wavelet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="n-basis">
                  Number of Basis Functions: {nBasis}
                  {hasRequiredData && (
                    <Badge variant="outline" className="ml-2">
                      Ruppert's rule: {getRuppertBasisCount(nPoints)}
                    </Badge>
                  )}
                </Label>
                <Slider value={[nBasis]} onValueChange={(v) => setNBasis(v[0])} max={40} min={4} step={1} />
                <div className="text-xs text-muted-foreground">
                  Range: 4 - 40 (Ruppert suggests {hasRequiredData ? getRuppertBasisCount(nPoints) : 'N/A'})
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lambda">
                  Smoothing Parameter (λ): {lambda.toFixed(2)}
                  <Button
                    variant="ghost" size="sm" className="ml-2 h-6 px-2 text-xs"
                    onClick={async () => {
                      if (hasRequiredData && rawData && domain) {
                        try {
                          const result = await apiAutoGCV(rawData, domain, basisType, nBasis)
                          if (typeof result?.lambda_opt === 'number') {
                            setLambda(Math.min(5.0, Math.max(0.01, result.lambda_opt)))
                          }
                        } catch (error) {
                          console.error('[Auto GCV] Error:', error)
                        }
                      }
                    }}
                  >
                    Auto (GCV)
                  </Button>
                </Label>
                <Slider value={[lambda]} onValueChange={(v) => setLambda(v[0])} max={5} min={0} step={0.01} />
                <div className="text-xs text-muted-foreground">Range: 0.00 - 5.00 (0 = no smoothing)</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataset-name">Dataset Name</Label>
                <Input id="dataset-name" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder="Enter dataset name" />
              </div>
            </CardContent>
          </Card>

          {globalMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>Quality Metrics</CardTitle>
                <CardDescription>Global fit across {nSpectra} curves</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">RMSE:</span>
                  <span className="font-mono text-sm">{globalMetrics.rmse.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">R²:</span>
                  <span className="font-mono text-sm">{globalMetrics.r2.toFixed(4)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Curves preview</CardTitle>
              <CardDescription>Original vs. fitted curve</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="spectrum-select">Select curve</Label>
                  <Select 
                    value={selectedSpectrumIndex === null ? "none" : selectedSpectrumIndex.toString()} 
                    onValueChange={(v) => setSelectedSpectrumIndex(v === "none" ? null : parseInt(v))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {Array.from({ length: nSpectra }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>Curve {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Tabs defaultValue="comparison" className="w-full">
                  <TabsList>
                    <TabsTrigger value="comparison">Comparison</TabsTrigger>
                    <TabsTrigger value="residuals">Residuals</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="comparison">
                    <div className="h-80">
                      <PlotlyChart
                        data={(() => {
                          const traces: any[] = []
                          const originalCurves = previewData.curves
                          const fittedCurves = fittedCurvesState

                          // Original en gris (todas)
                          originalCurves.forEach((c, i) => {
                            traces.push({
                              x: previewData.x,
                              y: c,
                              type: "scatter",
                              mode: "lines",
                              line: { color: "rgba(150,150,150,0.4)" },
                              name: `Original ${i + 1}`,
                              showlegend: false
                            })
                          })

                          if (selectedSpectrumIndex !== null && selectedSpectrumIndex < originalCurves.length) {
                            // Resaltar la seleccionada
                            traces.push({
                              x: previewData.x,
                              y: originalCurves[selectedSpectrumIndex],
                              type: "scatter",
                              mode: "lines",
                              line: { color: "blue", width: 2 },
                              name: `Original (Curve ${selectedSpectrumIndex + 1})`
                            })
                            if (fittedCurves[selectedSpectrumIndex]) {
                              traces.push({
                                x: previewData.x,
                                y: fittedCurves[selectedSpectrumIndex],
                                type: "scatter",
                                mode: "lines",
                                line: { color: "red", width: 2 },
                                name: `Fitted (Curve ${selectedSpectrumIndex + 1})`
                              })
                            }
                          } else {
                            // Modo None: todas las fitted en azul
                            fittedCurves.forEach((c, i) => {
                              traces.push({
                                x: previewData.x,
                                y: c,
                                type: "scatter",
                                mode: "lines",
                                line: { color: "blue" },
                                name: `Fitted ${i + 1}`,
                                showlegend: false
                              })
                            })
                          }
                          
                          return traces
                        })()}
                        layout={{ 
                          xaxis: { 
                            title: xAxisTitle,
                            showgrid: true,
                            gridcolor: '#f0f0f0'
                          },
                          yaxis: { 
                            title: yAxisTitle,
                            showgrid: true,
                            gridcolor: '#f0f0f0'
                          },
                          legend: {
                            x: 1,
                            y: 1,
                            xanchor: 'right',
                            yanchor: 'top'
                          }
                        }}
                        style={{ width: '100%', height: '100%' }}
                        className="w-full h-full"
                        config={{
                          displayModeBar: true,
                          displaylogo: false,
                          modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
                        }}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="residuals">
                    <div className="h-80">
                      <PlotlyChart
                        data={[
                          {
                            x: residualSeries.x,
                            y: residualSeries.y,
                            type: 'scatter',
                            mode: 'lines',
                            name: residualSeries.label || 'Residuals',
                            line: { width: 2 }
                          },
                          {
                            x: wavelengths,
                            y: new Array(wavelengths.length).fill(0),
                            type: 'scatter',
                            mode: 'lines',
                            name: 'Zero Line',
                            line: { width: 1, dash: 'dash' },
                            showlegend: false
                          }
                        ]}
                        layout={{
                          xaxis: { 
                            title: xAxisTitle,
                            showgrid: true,
                            gridcolor: '#f0f0f0'
                          },
                          yaxis: { 
                            title: selectedSpectrumIndex === null ? 'Mean residual' : 'Residual',
                            showgrid: true,
                            gridcolor: '#f0f0f0',
                            zeroline: true
                          },
                          legend: { 
                            orientation: 'h',
                            y: -0.2
                          }
                        }}
                        style={{ width: '100%', height: '100%' }}
                        className="w-full h-full"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Dataset - visible siempre; habilitado cuando hay fitted global */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">
                Save Functional Dataset 
                <Badge variant="secondary" className="ml-2">
                  {functionalBases.length}/5 saved
                </Badge>
              </h3>
              <p className="text-sm text-muted-foreground">
                {datasetName} • {basisType} • {nBasis} basis functions • λ = {lambda.toFixed(2)}
              </p>
            </div>
            
            <div className="flex gap-2">
              {/* Download complete functionalized dataset */}
              <Button
                variant="outline"
                onClick={handleDownloadData}
                disabled={
                  !hasRequiredData ||
                  fittedCurvesState.length === 0 ||
                  fittedCurvesState.length !== rawData?.length
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>

              {/* Guardar dataset funcional (usa fitted global) */}
              <Button
                onClick={handleSaveFunctionalDataset}
                disabled={!hasRequiredData || fittedCurvesState.length === 0 || isProcessing}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Functional Dataset
              </Button>

              {/* Avanzar al análisis */}
              <Button
                variant="secondary"
                onClick={() => {
                  if (functionalBases.length === 0) {
                    console.warn("⚠️ Save at least one functional dataset before proceeding")
                    return
                  }
                  handleProceedToAnalysis()
                }}
                disabled={functionalBases.length === 0}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Proceed to Analysis
              </Button>
            </div>
          </div>
          
          {functionalBases.length >= 5 && (
            <Alert className="mt-4">
              <AlertDescription>
                Maximum of 5 functional datasets reached. Delete existing datasets to add new ones.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Saved Datasets */}
      {functionalBases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Functional Datasets ({functionalBases.length}/5)</CardTitle>
            <CardDescription>
              Manage your saved functional datasets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {functionalBases.map((dataset, index) => (
                <div 
                  key={dataset.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${selectedBaseIndex === index ? 'bg-blue-50 border-blue-200' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSelectDataset(index)}
                      className="flex items-center gap-2"
                    >
                      {selectedBaseIndex === index ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      ) : (
                        <StarOff className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    
                    <div>
                      <div className="font-medium">{dataset.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {dataset.method} • {dataset.data.length} samples
                        {dataset.parameters && (
                          <span>
                            • {dataset.parameters.nBasis} bases
                            • λ = {dataset.parameters.lambda?.toFixed(3) || 'N/A'}
                            {dataset.parameters.metrics && (
                              <span> • R² = {dataset.parameters.metrics.r2?.toFixed(3)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedBaseIndex === index && (
                      <Badge variant="default">Active</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDataset(dataset.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Domain
            </Button>

            <div className="flex items-center gap-4">
              {functionalBases.length > 0 && selectedBaseIndex !== null && (
                <div className="text-sm text-green-600 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  {functionalBases[selectedBaseIndex]?.label} selected
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

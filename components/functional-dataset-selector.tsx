"use client"

import { useState } from 'react'
import { Star, AlertTriangle, Database, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

import { useAppState } from '@/hooks/useAppState'

interface FunctionalDatasetSelectorProps {
  showAlert?: boolean
  compact?: boolean
  className?: string
}

export function FunctionalDatasetSelector({ 
  showAlert = true, 
  compact = false,
  className = ""
}: FunctionalDatasetSelectorProps) {
  const { 
    functionalBases, 
    selectedBaseIndex, 
    selectFunctionalDataset 
  } = useAppState()

  const [showDetails, setShowDetails] = useState(false)

  const hasDatasets = functionalBases.length > 0
  const hasSelection = selectedBaseIndex !== null && selectedBaseIndex >= 0
  const activeDataset = hasSelection ? functionalBases[selectedBaseIndex] : null

  const handleSelectionChange = (value: string) => {
    const index = parseInt(value)
    selectFunctionalDataset(index)
  }

  const getQualityBadge = (r2?: number) => {
    if (!r2) return null
    
    if (r2 > 0.95) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Excellent</Badge>
    } else if (r2 > 0.90) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">Good</Badge>
    } else if (r2 > 0.80) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">Fair</Badge>
    } else {
      return <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">Poor</Badge>
    }
  }

  // No datasets available
  if (!hasDatasets) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Active Functional Dataset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No functional datasets available. Please complete the functionalization step first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Compact version for smaller spaces
  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Label className="text-sm font-medium">Active Dataset</Label>
        <Select
          value={hasSelection ? selectedBaseIndex.toString() : ""}
          onValueChange={handleSelectionChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select dataset..." />
          </SelectTrigger>
          <SelectContent>
            {functionalBases.map((dataset, index) => (
              <SelectItem key={dataset.id} value={index.toString()}>
                <div className="flex items-center gap-2">
                  <span>{dataset.label}{dataset.derivedOrder && dataset.derivedOrder>0 ? ` (derivative ${dataset.derivedOrder})` : ""}</span>
                  <Badge variant="outline" className="text-xs">
                    {dataset.method}
                  </Badge>
                  {dataset.parameters?.metrics?.r2 && (
                    <span className="text-xs text-muted-foreground">
                      R² {dataset.parameters.metrics.r2.toFixed(3)}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!hasSelection && showAlert && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Please select an active dataset to proceed with analysis.
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  // Full card version
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4" />
          Active Functional Dataset
          {hasSelection && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
        </CardTitle>
        <CardDescription>
          Select which functional dataset to use for analysis ({functionalBases.length}/5)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Dataset Selection</Label>
          <Select
            value={hasSelection ? selectedBaseIndex.toString() : ""}
            onValueChange={handleSelectionChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a functional dataset..." />
            </SelectTrigger>
            <SelectContent>
              {functionalBases.map((dataset, index) => (
                <SelectItem key={dataset.id} value={index.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{dataset.label}{dataset.derivedOrder && dataset.derivedOrder>0 ? ` (derivative ${dataset.derivedOrder})` : ""}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline" className="text-xs">
                        {dataset.method}
                      </Badge>
                      {getQualityBadge(dataset.parameters?.metrics?.r2)}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Dataset Details */}
        {activeDataset && (
          <div className="p-3 bg-blue-50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">{activeDataset.label}{activeDataset.derivedOrder && activeDataset.derivedOrder>0 ? ` (derivative ${activeDataset.derivedOrder})` : ""}</h4>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Method:</span>
                <span className="ml-1 font-mono">{activeDataset.method}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Samples:</span>
                <span className="ml-1 font-mono">{activeDataset.data.length}</span>
              </div>
              {activeDataset.parameters?.metrics?.r2 && (
                <div>
                  <span className="text-muted-foreground">R²:</span>
                  <span className="ml-1 font-mono">{activeDataset.parameters.metrics.r2.toFixed(3)}</span>
                </div>
              )}
              {activeDataset.parameters?.metrics?.rmse && (
                <div>
                  <span className="text-muted-foreground">RMSE:</span>
                  <span className="ml-1 font-mono">{activeDataset.parameters.metrics.rmse.toFixed(4)}</span>
                </div>
              )}
            </div>

            {showDetails && activeDataset.parameters && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Basis Functions:</span>
                    <span className="ml-1 font-mono">{activeDataset.parameters.nBasis || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Smoothing λ:</span>
                    <span className="ml-1 font-mono">{activeDataset.parameters.lambda?.toExponential(1) || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full mt-2 h-6 text-xs"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
        )}

        {/* Warning if no selection */}
        {!hasSelection && showAlert && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Selection Required:</strong> Choose an active dataset to proceed with analysis modules.
            </AlertDescription>
          </Alert>
        )}

        {/* Dataset Summary */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Available Datasets:</span>
            <span>{functionalBases.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Active Selection:</span>
            <span>{hasSelection ? 'Yes' : 'None'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Quick status component for minimal spaces
export function DatasetSelectionStatus() {
  const { functionalBases, selectedBaseIndex } = useAppState()
  
  const hasDatasets = functionalBases.length > 0
  const hasSelection = selectedBaseIndex !== null && selectedBaseIndex >= 0
  const activeDataset = hasSelection ? functionalBases[selectedBaseIndex] : null

  if (!hasDatasets) {
    return (
      <Badge variant="outline" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        No Datasets
      </Badge>
    )
  }

  if (!hasSelection) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        No Selection
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
      <Star className="h-3 w-3 fill-current" />
      {activeDataset?.label}{activeDataset?.derivedOrder && activeDataset.derivedOrder>0 ? ` (derivative ${activeDataset.derivedOrder})` : ""}
    </Badge>
  )
}

// Analysis gate component that blocks access
export function AnalysisGate({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode 
}) {
  const { functionalBases, selectedBaseIndex } = useAppState()
  
  const hasDatasets = functionalBases.length > 0
  const hasSelection = selectedBaseIndex !== null && selectedBaseIndex >= 0

  if (!hasDatasets || !hasSelection) {
    return (
      <div className="container mx-auto py-6">
        {fallback || (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Analysis Not Available
              </CardTitle>
              <CardDescription>
                Complete the required steps before accessing analysis modules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Requirements:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Upload raw spectral data ✅</li>
                      <li>Configure wavelength domain ✅</li>
                      <li>Create functional dataset(s) {hasDatasets ? '✅' : '❌'}</li>
                      <li>Select active dataset {hasSelection ? '✅' : '❌'}</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              {!hasDatasets && (
                <div className="text-center py-4">
                  <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Please complete the functionalization step to create at least one functional dataset.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => window.history.back()}>
                    Go to Functionalization
                  </Button>
                </div>
              )}

              {hasDatasets && !hasSelection && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You have {functionalBases.length} functional dataset(s) available. Please select one to proceed:
                  </p>
                  <FunctionalDatasetSelector compact showAlert={false} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return <>{children}</>
}
/**
 * Componente de Vista de Validación de Dominio
 * 
 * Este componente gestiona la configuración y validación del dominio espectral
 * (rango de longitudes de onda) para análisis de datos funcionales. Proporciona:
 * - Configuración interactiva de parámetros de dominio
 * - Validación en tiempo real de configuraciones de dominio
 * - Visualización de cobertura de dominio
 * - Integración con datos espectrales crudos
 * - Validación de consistencia de dominio con datos cargados
 */

"use client"

import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, CheckCircle, AlertTriangle, Calculator, Activity } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

import { useAppState, type DomainConfig } from '@/hooks/useAppState'

interface DomainValidationViewProps {
  onBack?: () => void
  onContinue?: () => void
}

export function DomainValidationView({ onBack, onContinue }: DomainValidationViewProps) {
  const { rawData, domain, setDomain } = useAppState()
  
  const [startWavelength, setStartWavelength] = useState<string>(
    domain?.startWavelength.toString() || '400'
  )
  const [endWavelength, setEndWavelength] = useState<string>(
    domain?.endWavelength.toString() || '700'
  )

  // Get number of points from raw data
  const nPoints = rawData?.[0]?.length || 0
  const hasRawData = rawData !== null && nPoints > 0
  
  // Domain confirmation state
  const [isConfirmed, setIsConfirmed] = useState(domain?.isConfirmed || false)
  const [confirmedValues, setConfirmedValues] = useState<{
    startWavelength: string
    endWavelength: string
    nPoints: number
  } | null>(null)

  // Sync with global domain state
  useEffect(() => {
    if (domain?.isConfirmed) {
      setIsConfirmed(true)
      setConfirmedValues({
        startWavelength: domain.startWavelength.toString(),
        endWavelength: domain.endWavelength.toString(),
        nPoints: domain.nPoints
      })
    }
  }, [domain])

  // Check if values have changed since confirmation
  const valuesChanged = useMemo(() => {
    if (!isConfirmed || !confirmedValues) return false
    
    return (
      startWavelength !== confirmedValues.startWavelength ||
      endWavelength !== confirmedValues.endWavelength ||
      nPoints !== confirmedValues.nPoints
    )
  }, [isConfirmed, confirmedValues, startWavelength, endWavelength, nPoints])

  // Reset confirmation state when values change
  useEffect(() => {
    if (isConfirmed && valuesChanged) {
      setIsConfirmed(false)
    }
  }, [isConfirmed, valuesChanged])

  // Calculate step size and validation
  const { stepSize, isValid, validationMessages } = useMemo(() => {
    if (!hasRawData) {
      return {
        stepSize: 0,
        isValid: false,
        validationMessages: ['No spectral data available']
      }
    }

    const start = parseFloat(startWavelength)
    const end = parseFloat(endWavelength)
    const messages: string[] = []

    // Input validation
    if (isNaN(start)) {
      messages.push('Start wavelength must be a valid number')
    }
    if (isNaN(end)) {
      messages.push('End wavelength must be a valid number')
    }
    if (!isNaN(start) && !isNaN(end)) {
      if (start >= end) {
        messages.push('Start wavelength must be less than end wavelength')
      }
      if (start < 0) {
        messages.push('Start wavelength must be positive')
      }
      if (end <= 0) {
        messages.push('End wavelength must be positive')
      }
    }

    let calculatedStepSize = 0
    if (!isNaN(start) && !isNaN(end) && nPoints > 1) {
      calculatedStepSize = (end - start) / (nPoints - 1)
      
      if (calculatedStepSize <= 0) {
        messages.push('Step size must be positive')
      } else if (calculatedStepSize < 0.01) {
        messages.push('Step size is very small - check wavelength range')
      } else if (calculatedStepSize > 100) {
        messages.push('Step size is very large - check wavelength range')
      }
    }

    return {
      stepSize: calculatedStepSize,
      isValid: messages.length === 0 && calculatedStepSize > 0,
      validationMessages: messages
    }
  }, [startWavelength, endWavelength, nPoints, hasRawData])

  // Handle confirm domain
  const handleConfirmDomain = () => {
    if (!isValid) return

    const domainConfig: DomainConfig = {
      startWavelength: parseFloat(startWavelength),
      endWavelength: parseFloat(endWavelength),
      nPoints,
      stepSize,
      isConfirmed: true
    }

    setDomain(domainConfig)
    setIsConfirmed(true)
    setConfirmedValues({
      startWavelength,
      endWavelength,
      nPoints
    })
  }

  // Handle proceed to functionalization
  const handleProceedToFunctionalization = () => {
    onContinue?.()
  }

  // Generate wavelength preview
  const wavelengthPreview = useMemo(() => {
    if (!isValid) return []
    
    const start = parseFloat(startWavelength)
    const preview: number[] = []
    
    // Show first 5 and last 5 wavelengths
    for (let i = 0; i < Math.min(5, nPoints); i++) {
      preview.push(start + i * stepSize)
    }
    
    if (nPoints > 10) {
      preview.push(-1) // Separator indicator
      for (let i = Math.max(5, nPoints - 5); i < nPoints; i++) {
        preview.push(start + i * stepSize)
      }
    }
    
    return preview
  }, [startWavelength, stepSize, nPoints, isValid])

  if (!hasRawData) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              No Data Available
            </CardTitle>
            <CardDescription>
              Please upload spectral data before configuring the domain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Upload
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
          <h1 className="text-3xl font-bold tracking-tight">Domain Configuration</h1>
          <p className="text-muted-foreground">
            Configure the wavelength domain for regular sampling
          </p>
        </div>
        
        {domain?.isConfirmed && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Domain Confirmed
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Wavelength Range
              </CardTitle>
              <CardDescription>
                Define the start and end wavelengths for your spectral data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-wavelength">Start Wavelength</Label>
                  <Input
                    id="start-wavelength"
                    type="number"
                    step="0.1"
                    placeholder="400"
                    value={startWavelength}
                    onChange={(e) => setStartWavelength(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end-wavelength">End Wavelength</Label>
                  <Input
                    id="end-wavelength"
                    type="number"
                    step="0.1"
                    placeholder="700"
                    value={endWavelength}
                    onChange={(e) => setEndWavelength(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Number of Points</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={nPoints}
                    disabled
                    className="bg-muted"
                  />
                  <Badge variant="outline">Auto-detected</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Determined from uploaded spectral data ({rawData?.length} samples)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Calculated Values */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Calculated Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Step Size</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={stepSize.toFixed(3)}
                    disabled
                    className="bg-muted font-mono"
                  />
                  <span className="text-sm text-muted-foreground">nm</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  ({endWavelength} - {startWavelength}) / ({nPoints} - 1) = {stepSize.toFixed(3)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Total Range</Label>
                <div className="text-sm">
                  <span className="font-mono">{isValid ? (parseFloat(endWavelength) - parseFloat(startWavelength)).toFixed(1) : '—'}</span>
                  <span className="text-muted-foreground ml-1">nm</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Resolution</Label>
                <div className="text-sm">
                  <span className="font-mono">{isValid ? stepSize.toFixed(3) : '—'}</span>
                  <span className="text-muted-foreground ml-1">nm/point</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview and Validation */}
        <div className="space-y-6">
          {/* Validation Messages */}
          {validationMessages.length > 0 && (
            <Alert variant={isValid ? "default" : "destructive"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationMessages.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Wavelength Preview */}
          {isValid && wavelengthPreview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Wavelength Preview</CardTitle>
                <CardDescription>
                  First and last wavelength points
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs">Index</Label>
                    </div>
                    <div>
                      <Label className="text-xs">Wavelength (nm)</Label>
                    </div>
                  </div>
                  
                  {wavelengthPreview.map((wavelength, index) => {
                    if (wavelength === -1) {
                      return (
                        <div key="separator" className="text-center text-muted-foreground py-1">
                          ⋮
                        </div>
                      )
                    }
                    
                    const actualIndex = wavelength === wavelengthPreview[wavelengthPreview.length - 1] 
                      ? nPoints - 1 
                      : index > 5 ? nPoints - (wavelengthPreview.length - index - 1) : index
                    
                    return (
                      <div key={index} className="grid grid-cols-2 gap-4 text-sm font-mono">
                        <div>{actualIndex}</div>
                        <div>{wavelength.toFixed(2)}</div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Data Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Samples:</span>
                <span className="font-mono">{rawData?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Wavelength Points:</span>
                <span className="font-mono">{nPoints}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Data Shape:</span>
                <span className="font-mono">{rawData?.length || 0} × {nPoints}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Upload
            </Button>

            <div className="flex items-center gap-4">
              {isValid && !isConfirmed && (
                <div className="text-sm text-green-600 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Domain configuration is valid
                </div>
              )}
              
              {!isConfirmed ? (
                <Button 
                  onClick={handleConfirmDomain}
                  disabled={!isValid}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Confirm Domain
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Domain confirmed successfully.</span>
                  </div>
                  <Button 
                    onClick={handleProceedToFunctionalization}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Proceed to Functionalization
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
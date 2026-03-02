"use client"

import { useEffect } from "react"
import { CheckCircle2, AlertTriangle, XCircle, Info, Zap, Target, BarChart3 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { UploadState } from "@/components/data-upload-module"

interface FinalValidationSummaryProps {
  uploadState: UploadState
  onStateUpdate: (updates: Partial<UploadState>) => void
}

export function FinalValidationSummary({ uploadState, onStateUpdate }: FinalValidationSummaryProps) {
  // Perform final validation when component mounts
  useEffect(() => {
    performFinalValidation()
  }, [])

  const performFinalValidation = () => {
    const validationStatus = { ...uploadState.validationStatus }

    // Validate spectral matrix
    validationStatus.spectralMatrix = uploadState.spectralMatrix?.isValid === true

    // Validate frequency matrix (for irregular sampling)
    if (uploadState.config.samplingType === "irregular") {
      validationStatus.frequencyMatrix = uploadState.frequencyMatrix?.isValid === true
    } else {
      validationStatus.frequencyMatrix = true // Not required for regular sampling
    }

    // Validate domain parameters (for regular sampling)
    if (uploadState.config.samplingType === "regular") {
      const domainParams = uploadState.config.domainParameters
      validationStatus.domainParameters =
        domainParams &&
        domainParams.startWavelength < domainParams.endWavelength &&
        domainParams.numberOfPoints > 0 &&
        (uploadState.spectralMatrix ? domainParams.numberOfPoints === uploadState.spectralMatrix.columnCount : true)
    } else {
      validationStatus.domainParameters = true // Not required for irregular sampling
    }

    // Validate scalar variables (optional)
    if (uploadState.scalarVariables) {
      validationStatus.scalarVariables = uploadState.scalarVariables.isValid === true
    } else {
      validationStatus.scalarVariables = true // Optional
    }

    // Overall validation
    validationStatus.overall =
      validationStatus.spectralMatrix &&
      validationStatus.frequencyMatrix &&
      validationStatus.domainParameters &&
      validationStatus.scalarVariables

    onStateUpdate({ validationStatus })
  }

  const getStatusIcon = (status: boolean | null) => {
    if (status === true) return <CheckCircle2 className="h-5 w-5 text-green-500" />
    if (status === false) return <XCircle className="h-5 w-5 text-red-500" />
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  }

  const getStatusText = (status: boolean | null) => {
    if (status === true) return "Valid"
    if (status === false) return "Invalid"
    return "Pending"
  }

  const getStatusVariant = (status: boolean | null) => {
    if (status === true) return "default"
    if (status === false) return "destructive"
    return "secondary"
  }

  // Determine available analysis modules
  const availableModules = {
    unsupervised: uploadState.validationStatus.spectralMatrix === true,
    supervised:
      uploadState.validationStatus.spectralMatrix === true &&
      uploadState.scalarVariables !== null &&
      uploadState.config.targetVariable !== null,
  }

  // Generate warnings and suggestions
  const warnings: string[] = []
  const suggestions: { message: string; action?: () => void }[] = []

  if (uploadState.scalarVariables && !uploadState.config.targetVariable) {
    warnings.push("No target variable selected - supervised analysis will be disabled")
    suggestions.push({
      message: "Select a target variable to enable regression and classification",
    })
  }

  if (uploadState.scalarVariables && uploadState.config.predictorVariables.length === 0) {
    warnings.push("No predictor variables selected")
  }

  // Check for potential categorical variables
  if (uploadState.scalarVariables) {
    uploadState.scalarVariables.headers.forEach((header) => {
      if (!uploadState.config.categoricalColumns.includes(header)) {
        // Check if column might be categorical (simplified check)
        const lines = uploadState.scalarVariables!.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
        const separator = lines[0].includes(";") ? ";" : ","
        const dataStartIndex = uploadState.scalarVariables!.hasHeaders ? 1 : 0
        const colIndex = uploadState.scalarVariables!.headers.indexOf(header)

        if (colIndex >= 0 && lines.length > dataStartIndex) {
          const sampleValues = lines.slice(dataStartIndex, dataStartIndex + 3)
          const hasNonNumeric = sampleValues.some((line) => {
            const values = line.split(separator)
            const value = values[colIndex]?.trim().replace(",", ".")
            return value && isNaN(Number(value))
          })

          if (hasNonNumeric) {
            suggestions.push({
              message: `Column "${header}" contains non-numeric values. Mark as categorical?`,
              action: () => {
                onStateUpdate({
                  config: {
                    ...uploadState.config,
                    categoricalColumns: [...uploadState.config.categoricalColumns, header],
                  },
                })
                performFinalValidation()
              },
            })
          }
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Final Validation & Summary</h2>
        <p className="text-muted-foreground">
          Review your data configuration and validation results before proceeding to analysis.
        </p>
      </div>

      {/* Overall Status */}
      <Alert variant={uploadState.validationStatus.overall ? "default" : "destructive"}>
        {uploadState.validationStatus.overall ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        <AlertTitle>
          {uploadState.validationStatus.overall ? "✅ Validation Successful" : "❌ Validation Issues"}
        </AlertTitle>
        <AlertDescription>
          {uploadState.validationStatus.overall
            ? "All required data has been validated successfully. You can proceed to analysis."
            : "Please resolve the validation issues below before proceeding."}
        </AlertDescription>
      </Alert>

      {/* Validation Details */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Spectral Matrix Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {getStatusIcon(uploadState.validationStatus.spectralMatrix)}
              Spectral Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={getStatusVariant(uploadState.validationStatus.spectralMatrix)}>
              {getStatusText(uploadState.validationStatus.spectralMatrix)}
            </Badge>
            {uploadState.spectralMatrix && (
              <div className="text-sm text-muted-foreground">
                <p>{uploadState.spectralMatrix.name}</p>
                <p>
                  {uploadState.spectralMatrix.rowCount} × {uploadState.spectralMatrix.columnCount}
                </p>
                <p>Sampling: {uploadState.config.samplingType}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Domain/Frequency Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {uploadState.config.samplingType === "regular"
                ? getStatusIcon(uploadState.validationStatus.domainParameters)
                : getStatusIcon(uploadState.validationStatus.frequencyMatrix)}
              {uploadState.config.samplingType === "regular" ? "Domain Parameters" : "Frequency Matrix"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge
              variant={getStatusVariant(
                uploadState.config.samplingType === "regular"
                  ? uploadState.validationStatus.domainParameters
                  : uploadState.validationStatus.frequencyMatrix,
              )}
            >
              {getStatusText(
                uploadState.config.samplingType === "regular"
                  ? uploadState.validationStatus.domainParameters
                  : uploadState.validationStatus.frequencyMatrix,
              )}
            </Badge>
            {uploadState.config.samplingType === "regular" && uploadState.config.domainParameters && (
              <div className="text-sm text-muted-foreground">
                <p>
                  {uploadState.config.domainParameters.startWavelength} -{" "}
                  {uploadState.config.domainParameters.endWavelength} nm
                </p>
                <p>{uploadState.config.domainParameters.numberOfPoints} points</p>
                <p>Δλ = {uploadState.config.domainParameters.stepSize.toFixed(4)} nm</p>
              </div>
            )}
            {uploadState.config.samplingType === "irregular" && uploadState.frequencyMatrix && (
              <div className="text-sm text-muted-foreground">
                <p>{uploadState.frequencyMatrix.name}</p>
                <p>
                  {uploadState.frequencyMatrix.rowCount} × {uploadState.frequencyMatrix.columnCount}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scalar Variables Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {getStatusIcon(uploadState.validationStatus.scalarVariables)}
              Scalar Variables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant={getStatusVariant(uploadState.validationStatus.scalarVariables)}>
              {uploadState.scalarVariables ? getStatusText(uploadState.validationStatus.scalarVariables) : "Optional"}
            </Badge>
            {uploadState.scalarVariables ? (
              <div className="text-sm text-muted-foreground">
                <p>{uploadState.scalarVariables.name}</p>
                <p>{uploadState.scalarVariables.columnCount} variables</p>
                {uploadState.config.targetVariable && <p>Target: {uploadState.config.targetVariable}</p>}
                <p>Predictors: {uploadState.config.predictorVariables.length}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not provided (unsupervised only)</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warnings and Suggestions */}
      {(warnings.length > 0 || suggestions.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Warnings & Suggestions</h3>

          {warnings.map((warning, i) => (
            <Alert key={i}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          ))}

          {suggestions.map((suggestion, i) => (
            <Alert key={i} className="border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">Suggestion</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span className="text-orange-700">{suggestion.message}</span>
                {suggestion.action && (
                  <Button variant="outline" size="sm" onClick={suggestion.action} className="ml-4">
                    Fix
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Available Analysis Modules */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Available Analysis Modules</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className={availableModules.unsupervised ? "border-green-200 bg-green-50" : "border-gray-200"}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Zap className={`h-5 w-5 ${availableModules.unsupervised ? "text-green-600" : "text-gray-400"}`} />
                Unsupervised Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant={availableModules.unsupervised ? "default" : "secondary"}>
                  {availableModules.unsupervised ? "Available" : "Unavailable"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {availableModules.unsupervised
                    ? "Exploratory analysis, functionalization, FPCA, and clustering modules are ready."
                    : "Requires valid spectral matrix."}
                </p>
                {availableModules.unsupervised && (
                  <div className="text-xs text-muted-foreground">
                    <p>• Data exploration and visualization</p>
                    <p>• Functional data representation</p>
                    <p>• Principal component analysis</p>
                    <p>• Clustering and pattern detection</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={availableModules.supervised ? "border-blue-200 bg-blue-50" : "border-gray-200"}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Target className={`h-5 w-5 ${availableModules.supervised ? "text-blue-600" : "text-gray-400"}`} />
                Supervised Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant={availableModules.supervised ? "default" : "secondary"}>
                  {availableModules.supervised ? "Available" : "Unavailable"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {availableModules.supervised
                    ? "Regression and classification modules are ready with your scalar variables."
                    : "Requires scalar variables with a target variable."}
                </p>
                {availableModules.supervised && (
                  <div className="text-xs text-muted-foreground">
                    <p>• Functional regression (FPCR)</p>
                    <p>• Functional classification (FPCLoR)</p>
                    <p>• Prediction and model validation</p>
                    <p>• Variable importance analysis</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Data Summary
          </CardTitle>
          <CardDescription>Complete overview of your uploaded and configured data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Spectral Data</h4>
              <div className="text-sm text-muted-foreground">
                <p>
                  Samples:{" "}
                  {uploadState.spectralMatrix
                    ? uploadState.spectralMatrix.hasHeaders
                      ? uploadState.spectralMatrix.rowCount - 1
                      : uploadState.spectralMatrix.rowCount
                    : 0}
                </p>
                <p>Variables: {uploadState.spectralMatrix?.columnCount || 0}</p>
                <p>Type: {uploadState.config.samplingType}</p>
              </div>
            </div>

            {uploadState.config.samplingType === "regular" && uploadState.config.domainParameters && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Domain</h4>
                <div className="text-sm text-muted-foreground">
                  <p>
                    Range: {uploadState.config.domainParameters.startWavelength} -{" "}
                    {uploadState.config.domainParameters.endWavelength} nm
                  </p>
                  <p>Resolution: {uploadState.config.domainParameters.stepSize.toFixed(4)} nm</p>
                </div>
              </div>
            )}

            {uploadState.scalarVariables && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Scalar Variables</h4>
                <div className="text-sm text-muted-foreground">
                  <p>Variables: {uploadState.scalarVariables.columnCount}</p>
                  <p>Target: {uploadState.config.targetVariable || "None"}</p>
                  <p>Predictors: {uploadState.config.predictorVariables.length}</p>
                  <p>Categorical: {uploadState.config.categoricalColumns.length}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

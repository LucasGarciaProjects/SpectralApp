"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, FileText, AlertTriangle, X, BarChart3, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { FileData, UploadState } from "@/components/data-upload-module"

interface ScalarVariablesUploadProps {
  uploadState: UploadState
  onStateUpdate: (updates: Partial<UploadState>) => void
}

export function ScalarVariablesUpload({ uploadState, onStateUpdate }: ScalarVariablesUploadProps) {
  const [dragActive, setDragActive] = useState(false)

  // Parse file content
  const parseFileContent = useCallback((file: File, content: string): FileData => {
    const lines = content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const separator = lines[0].includes(";") ? ";" : ","

    const preview: string[][] = []
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const values = lines[i].split(separator)
      preview.push(values.slice(0, 10))
    }

    const hasHeaders = true
    const headers = preview[0] ? [...preview[0]] : []
    const rowCount = lines.length
    const columnCount = preview[0] ? preview[0].length : 0

    return {
      name: file.name,
      content,
      preview,
      hasHeaders,
      headers,
      isValid: null,
      errors: [],
      warnings: [],
      rowCount,
      columnCount,
    }
  }, [])

  // Validate scalar variables
  const validateScalarVariables = useCallback(
    (fileData: FileData): FileData => {
      const errors: string[] = []
      const warnings: string[] = []
      let isValid = true

      if (!uploadState.spectralMatrix) {
        errors.push("Spectral matrix must be uploaded first")
        return { ...fileData, isValid: false, errors, warnings }
      }

      const lines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
      const separator = lines[0].includes(";") ? ";" : ","

      // Check row count match
      const spectralDataRows = uploadState.spectralMatrix.hasHeaders
        ? uploadState.spectralMatrix.rowCount - 1
        : uploadState.spectralMatrix.rowCount
      const scalarDataRows = fileData.hasHeaders ? fileData.rowCount - 1 : fileData.rowCount

      if (scalarDataRows !== spectralDataRows) {
        errors.push(
          `Row count mismatch: scalar file has ${scalarDataRows} data rows, but spectral matrix has ${spectralDataRows} data rows`,
        )
        isValid = false
      }

      // Check minimum requirements
      if (fileData.columnCount < 1) {
        errors.push("File must have at least 1 column")
        isValid = false
      }

      // Check for missing values
      const dataStartIndex = fileData.hasHeaders ? 1 : 0
      for (let i = dataStartIndex; i < Math.min(lines.length, dataStartIndex + 3); i++) {
        const values = lines[i].split(separator)
        for (let j = 0; j < values.length; j++) {
          if (values[j].trim() === "") {
            errors.push(`Missing value at row ${i + 1}, column ${j + 1}`)
            isValid = false
            break
          }
        }
        if (!isValid) break
      }

      // Check for non-numeric values in numeric columns
      const dataStartIdx = fileData.hasHeaders ? 1 : 0
      for (let i = dataStartIdx; i < Math.min(lines.length, dataStartIdx + 3); i++) {
        const values = lines[i].split(separator)
        for (let j = 0; j < values.length && j < fileData.headers.length; j++) {
          const header = fileData.headers[j]
          const isCategorical = uploadState.config.categoricalColumns.includes(header)

          if (!isCategorical) {
            const value = values[j].trim().replace(",", ".")
            if (value !== "" && isNaN(Number(value))) {
              warnings.push(`Non-numeric value in column "${header}" at row ${i + 1}. Consider marking as categorical.`)
            }
          }
        }
      }

      return { ...fileData, isValid, errors, warnings }
    },
    [uploadState.spectralMatrix, uploadState.config.categoricalColumns],
  )

  // Analyze column statistics
  const analyzeColumnStats = useCallback(
    (fileData: FileData) => {
      const stats: Record<string, any> = {}
      const lines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
      const separator = lines[0].includes(";") ? ";" : ","
      const dataStartIndex = fileData.hasHeaders ? 1 : 0

      fileData.headers.forEach((header, colIndex) => {
        const isCategorical = uploadState.config.categoricalColumns.includes(header)
        const values: string[] = []

        for (let i = dataStartIndex; i < Math.min(lines.length, dataStartIndex + 10); i++) {
          const rowValues = lines[i].split(separator)
          if (rowValues[colIndex]) {
            values.push(rowValues[colIndex].trim())
          }
        }

        if (isCategorical) {
          const frequencies: Record<string, number> = {}
          values.forEach((value) => {
            frequencies[value] = (frequencies[value] || 0) + 1
          })
          stats[header] = { type: "categorical", frequencies, sampleSize: values.length }
        } else {
          const numericValues = values.map((v) => Number(v.replace(",", "."))).filter((v) => !isNaN(v))
          if (numericValues.length > 0) {
            stats[header] = {
              type: "numeric",
              min: Math.min(...numericValues),
              max: Math.max(...numericValues),
              mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
              count: numericValues.length,
            }
          }
        }
      })

      return stats
    },
    [uploadState.config.categoricalColumns],
  )

  // Handle file upload
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      const file = files[0]
      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result as string
        let fileData = parseFileContent(file, content)
        fileData = validateScalarVariables(fileData)

        onStateUpdate({
          scalarVariables: fileData,
          config: {
            ...uploadState.config,
            targetVariable: null,
            predictorVariables: [],
            categoricalColumns: [],
          },
          validationStatus: {
            ...uploadState.validationStatus,
            scalarVariables: fileData.isValid,
          },
        })
      }

      reader.readAsText(file)
    },
    [parseFileContent, validateScalarVariables, uploadState.config, onStateUpdate],
  )

  // Handle categorical toggle
  const handleCategoricalToggle = useCallback(
    (column: string, isCategorical: boolean) => {
      const newCategoricalColumns = isCategorical
        ? [...uploadState.config.categoricalColumns, column]
        : uploadState.config.categoricalColumns.filter((c) => c !== column)

      onStateUpdate({
        config: {
          ...uploadState.config,
          categoricalColumns: newCategoricalColumns,
        },
      })

      // Re-validate if file exists
      if (uploadState.scalarVariables) {
        const updatedFile = validateScalarVariables(uploadState.scalarVariables)
        onStateUpdate({
          scalarVariables: updatedFile,
          validationStatus: {
            ...uploadState.validationStatus,
            scalarVariables: updatedFile.isValid,
          },
        })
      }
    },
    [uploadState, onStateUpdate, validateScalarVariables],
  )

  // Handle target variable selection
  const handleTargetVariableChange = useCallback(
    (value: string) => {
      const newTarget = value === "none" ? null : value
      onStateUpdate({
        config: {
          ...uploadState.config,
          targetVariable: newTarget,
          predictorVariables: uploadState.config.predictorVariables.filter((v) => v !== value),
        },
      })
    },
    [uploadState.config, onStateUpdate],
  )

  // Handle predictor variable selection
  const handlePredictorVariableChange = useCallback(
    (variable: string, checked: boolean) => {
      if (checked) {
        if (
          !uploadState.config.predictorVariables.includes(variable) &&
          uploadState.config.targetVariable !== variable
        ) {
          onStateUpdate({
            config: {
              ...uploadState.config,
              predictorVariables: [...uploadState.config.predictorVariables, variable],
            },
          })
        }
      } else {
        onStateUpdate({
          config: {
            ...uploadState.config,
            predictorVariables: uploadState.config.predictorVariables.filter((v) => v !== variable),
          },
        })
      }
    },
    [uploadState.config, onStateUpdate],
  )

  // Handle header toggle
  const handleHeaderToggle = useCallback(
    (hasHeaders: boolean) => {
      if (!uploadState.scalarVariables) return

      const updatedFile = { ...uploadState.scalarVariables, hasHeaders }
      if (!hasHeaders) {
        updatedFile.headers = Array.from({ length: uploadState.scalarVariables.columnCount }, (_, i) => `V${i + 1}`)
      } else {
        updatedFile.headers = uploadState.scalarVariables.preview[0] || []
      }

      const validatedFile = validateScalarVariables(updatedFile)
      onStateUpdate({
        scalarVariables: validatedFile,
        config: {
          ...uploadState.config,
          targetVariable: null,
          predictorVariables: [],
          categoricalColumns: [],
        },
        validationStatus: {
          ...uploadState.validationStatus,
          scalarVariables: validatedFile.isValid,
        },
      })
    },
    [uploadState.scalarVariables, validateScalarVariables, uploadState.config, onStateUpdate],
  )

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files?.length > 0) {
        handleFileUpload(e.dataTransfer.files)
      }
    },
    [handleFileUpload],
  )

  const columnStats = uploadState.scalarVariables ? analyzeColumnStats(uploadState.scalarVariables) : {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Scalar Variables (Optional)</h2>
        <p className="text-muted-foreground">
          Upload scalar variables for supervised analysis. This enables regression and classification modules.
        </p>
      </div>

      {!uploadState.spectralMatrix ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Spectral Matrix Required</AlertTitle>
          <AlertDescription>
            Please upload and validate your spectral matrix in the previous step first.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* File Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Scalar Variables File</CardTitle>
              <CardDescription>
                Upload CSV/TXT file with response and predictor variables (same sample order as spectral data)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!uploadState.scalarVariables ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">Drop scalar variables file here</p>
                  <p className="text-sm text-gray-500 mb-4">or click to browse (optional step)</p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    id="scalar-upload"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <Button variant="outline" onClick={() => document.getElementById("scalar-upload")?.click()}>
                    <FileText className="mr-2 h-4 w-4" />
                    Select File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Skip this step if you only want unsupervised analysis
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert variant={uploadState.scalarVariables.isValid ? "default" : "destructive"}>
                    <FileText className="h-4 w-4" />
                    <AlertTitle>
                      {uploadState.scalarVariables.isValid ? "File Uploaded Successfully" : "File Issues Detected"}
                    </AlertTitle>
                    <AlertDescription>
                      {uploadState.scalarVariables.name} - {uploadState.scalarVariables.rowCount} rows ×{" "}
                      {uploadState.scalarVariables.columnCount} columns
                    </AlertDescription>
                  </Alert>

                  {/* Header Toggle */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="scalar-headers"
                      checked={uploadState.scalarVariables.hasHeaders}
                      onCheckedChange={handleHeaderToggle}
                    />
                    <Label htmlFor="scalar-headers">First row contains headers</Label>
                  </div>

                  {/* File Preview */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Preview (first 5 rows)</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {uploadState.scalarVariables.preview.map((row, i) => (
                            <tr
                              key={i}
                              className={
                                i === 0 && uploadState.scalarVariables?.hasHeaders ? "font-medium bg-gray-50" : ""
                              }
                            >
                              {row.map((cell, j) => (
                                <td key={j} className="border px-2 py-1 max-w-20 truncate">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Errors and Warnings */}
                  {uploadState.scalarVariables.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Errors</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside">
                          {uploadState.scalarVariables.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {uploadState.scalarVariables.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warnings</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside">
                          {uploadState.scalarVariables.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button variant="outline" size="sm" onClick={() => onStateUpdate({ scalarVariables: null })}>
                    <X className="mr-1 h-4 w-4" />
                    Remove File
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variable Configuration */}
          {uploadState.scalarVariables && uploadState.scalarVariables.isValid && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Target Variable Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Target Variable</CardTitle>
                  <CardDescription>Select the response variable for supervised analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={uploadState.config.targetVariable || "none"}
                    onValueChange={handleTargetVariableChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target variable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Unsupervised only)</SelectItem>
                      {uploadState.scalarVariables.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header} ({uploadState.config.categoricalColumns.includes(header) ? "Categorical" : "Numeric"}
                          )
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {uploadState.config.targetVariable && columnStats[uploadState.config.targetVariable] && (
                    <div className="rounded-md bg-muted p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {uploadState.config.categoricalColumns.includes(uploadState.config.targetVariable) ? (
                          <BarChart3 className="h-4 w-4" />
                        ) : (
                          <TrendingUp className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">{uploadState.config.targetVariable} Statistics</span>
                      </div>
                      {uploadState.config.categoricalColumns.includes(uploadState.config.targetVariable) ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground mb-1">Categories (sample):</p>
                          {Object.entries(columnStats[uploadState.config.targetVariable].frequencies || {}).map(
                            ([value, count]) => (
                              <div key={value} className="flex justify-between text-sm">
                                <span>{value}</span>
                                <span>{count}</span>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>Min: {columnStats[uploadState.config.targetVariable].min?.toFixed(2)}</div>
                          <div>Max: {columnStats[uploadState.config.targetVariable].max?.toFixed(2)}</div>
                          <div>Mean: {columnStats[uploadState.config.targetVariable].mean?.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Predictor Variables Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Predictor Variables</CardTitle>
                  <CardDescription>Select variables to use as predictors</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const availablePredictors = uploadState.scalarVariables!.headers.filter(
                          (h) => h !== uploadState.config.targetVariable,
                        )
                        onStateUpdate({
                          config: {
                            ...uploadState.config,
                            predictorVariables: availablePredictors,
                          },
                        })
                      }}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onStateUpdate({
                          config: {
                            ...uploadState.config,
                            predictorVariables: [],
                          },
                        })
                      }
                    >
                      Select None
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {uploadState.scalarVariables.headers.map((header) => (
                      <div key={header} className="flex items-center space-x-2">
                        <Checkbox
                          id={`predictor-${header}`}
                          checked={uploadState.config.predictorVariables.includes(header)}
                          disabled={uploadState.config.targetVariable === header}
                          onCheckedChange={(checked) => handlePredictorVariableChange(header, checked === true)}
                        />
                        <Label
                          htmlFor={`predictor-${header}`}
                          className={`flex-1 ${
                            uploadState.config.targetVariable === header ? "text-muted-foreground" : ""
                          }`}
                        >
                          {header}
                          {uploadState.config.targetVariable === header && " (target)"}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({uploadState.config.categoricalColumns.includes(header) ? "Categorical" : "Numeric"})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Variable Type Configuration */}
          {uploadState.scalarVariables && uploadState.scalarVariables.isValid && (
            <Card>
              <CardHeader>
                <CardTitle>Variable Types</CardTitle>
                <CardDescription>
                  Configure each variable as numeric or categorical. Categorical variables can contain non-numeric
                  values.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uploadState.scalarVariables.headers.map((header) => (
                    <div key={header} className="flex items-center justify-between border-b pb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{header}</span>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`categorical-${header}`}
                              checked={uploadState.config.categoricalColumns.includes(header)}
                              onCheckedChange={(checked) => handleCategoricalToggle(header, checked)}
                            />
                            <Label htmlFor={`categorical-${header}`} className="text-sm">
                              Mark as Categorical
                            </Label>
                          </div>
                        </div>
                        {columnStats[header] && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {uploadState.config.categoricalColumns.includes(header) ? (
                              <div>
                                Categories:{" "}
                                {Object.keys(columnStats[header].frequencies || {})
                                  .slice(0, 3)
                                  .join(", ")}
                                {Object.keys(columnStats[header].frequencies || {}).length > 3 && "..."}
                              </div>
                            ) : (
                              <div>
                                Range: {columnStats[header].min?.toFixed(2)} - {columnStats[header].max?.toFixed(2)}{" "}
                                (Mean: {columnStats[header].mean?.toFixed(2)})
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Requirements Box */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-medium mb-2">📋 Scalar Variables Requirements</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• CSV or TXT format with comma/semicolon separators</li>
          <li>• Each row corresponds to a sample (same order as spectral data)</li>
          <li>• Each column is a scalar variable (numeric or categorical)</li>
          <li>• Must have same number of data rows as spectral matrix</li>
          <li>• Headers recommended for variable identification</li>
          <li>• Categorical variables can contain any values (text, numbers)</li>
          <li>• Numeric variables must contain only numeric values</li>
          <li>• At least one target variable required for supervised analysis</li>
        </ul>
      </div>
    </div>
  )
}

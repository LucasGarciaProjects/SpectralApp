"use client"

import type React from "react"

import { useCallback, useState, useMemo } from "react"
import { FileText, HelpCircle, Upload, X, BarChart3, TrendingUp } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import type { FileData, UploadConfig } from "@/components/data-upload-module"
import { FilePreview } from "@/components/file-preview"
import { HeaderEditor } from "@/components/header-editor"

interface ScalarVariablesStepProps {
  scalarFile: FileData | null
  setScalarFile: (file: FileData | null) => void
  spectraFile: FileData | null
  config: UploadConfig
  setConfig: (config: UploadConfig) => void
}

export function ScalarVariablesStep({
  scalarFile,
  setScalarFile,
  spectraFile,
  config,
  setConfig,
}: ScalarVariablesStepProps) {
  const [dragActive, setDragActive] = useState(false)

  // Parse file content and create FileData object
  const parseFileContent = useCallback((file: File, content: string): FileData => {
    const lines = content.split(/\r\n|\n/).filter((line) => line.trim() !== "")

    // Determine the separator based on the first line
    const firstLine = lines[0]
    const separator = firstLine.includes(";") ? ";" : ","

    // Create preview (first 10 rows, up to 15 columns)
    const preview: string[][] = []
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i]
      const values = line.split(separator)
      preview.push(values.slice(0, 15))
    }

    // Default to having headers
    const hasHeaders = true
    const headers = preview[0] ? [...preview[0]] : []

    // Calculate dimensions
    const rowCount = lines.length
    const columnCount = preview[0] ? preview[0].length : 0

    return {
      name: file.name,
      content,
      preview,
      hasHeaders,
      headers,
      isValid: null, // Will be validated later
      errors: [],
      warnings: [],
      rowCount,
      columnCount,
    }
  }, [])

  // Validate scalar file
  const validateScalarFile = useCallback(
    (fileData: FileData, spectraFile: FileData, config: UploadConfig): FileData => {
      const errors: string[] = []
      const warnings: string[] = []
      let isValid = true

      const scalarLines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
      const spectraLines = spectraFile.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
      const separator = scalarLines[0].includes(";") ? ";" : ","

      // Check minimum requirements
      if (scalarLines.length < 1) {
        errors.push("Scalar file must have at least one row.")
        isValid = false
        return { ...fileData, isValid, errors, warnings }
      }

      // Check if scalar file has the same number of data rows as spectra file
      const spectraDataRows = spectraFile.hasHeaders ? spectraLines.length - 1 : spectraLines.length
      const scalarDataRows = fileData.hasHeaders ? scalarLines.length - 1 : scalarLines.length

      if (scalarDataRows !== spectraDataRows) {
        errors.push(
          `Scalar file has ${scalarDataRows} data rows, but spectra file has ${spectraDataRows} data rows. They must match.`,
        )
        isValid = false
      }

      // Check if all rows have the same number of columns
      const columnCounts = scalarLines.map((line) => line.split(separator).length)
      const allSameColumnCount = columnCounts.every((count) => count === columnCounts[0])
      if (!allSameColumnCount) {
        errors.push("All rows in scalar file must have the same number of columns.")
        isValid = false
      }

      // Check for missing values
      const dataStartIndex = fileData.hasHeaders ? 1 : 0
      for (let i = dataStartIndex; i < Math.min(scalarLines.length, dataStartIndex + 5); i++) {
        const values = scalarLines[i].split(separator)
        for (let j = 0; j < values.length; j++) {
          if (values[j].trim() === "") {
            errors.push(`Missing value found at row ${i + 1}, column ${j + 1}.`)
            isValid = false
            break
          }
        }
        if (!isValid) break
      }

      // Check numeric columns for non-numeric values
      const dataStartIdx = fileData.hasHeaders ? 1 : 0
      for (let i = dataStartIdx; i < Math.min(scalarLines.length, dataStartIdx + 5); i++) {
        const values = scalarLines[i].split(separator)
        for (let j = 0; j < values.length && j < fileData.headers.length; j++) {
          const header = fileData.headers[j]
          const isCategorical = config.categoricalColumns.includes(header)

          if (!isCategorical) {
            const value = values[j].trim().replace(",", ".")
            if (value !== "" && isNaN(Number(value))) {
              warnings.push(`Column "${header}" contains non-numeric values - mark as categorical?`)
            }
          }
        }
      }

      return { ...fileData, isValid, errors, warnings }
    },
    [],
  )

  // Analyze column statistics
  const analyzeColumnStats = useCallback((fileData: FileData, config: UploadConfig) => {
    const stats: Record<string, any> = {}
    const lines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const separator = lines[0].includes(";") ? ";" : ","
    const dataStartIndex = fileData.hasHeaders ? 1 : 0

    fileData.headers.forEach((header, colIndex) => {
      const isCategorical = config.categoricalColumns.includes(header)
      const values: string[] = []

      for (let i = dataStartIndex; i < lines.length; i++) {
        const rowValues = lines[i].split(separator)
        if (rowValues[colIndex]) {
          values.push(rowValues[colIndex].trim())
        }
      }

      if (isCategorical) {
        // Calculate frequency distribution
        const frequencies: Record<string, number> = {}
        values.forEach((value) => {
          frequencies[value] = (frequencies[value] || 0) + 1
        })
        stats[header] = { type: "categorical", frequencies }
      } else {
        // Calculate numeric statistics
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
  }, [])

  // Get column statistics
  const columnStats = useMemo(() => {
    if (!scalarFile) return {}
    return analyzeColumnStats(scalarFile, config)
  }, [scalarFile, config, analyzeColumnStats])

  // Handle file upload
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      const file = files[0]
      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result as string
        let fileData = parseFileContent(file, content)

        if (spectraFile) {
          fileData = validateScalarFile(fileData, spectraFile, config)
        }

        setScalarFile(fileData)

        // Reset configuration
        setConfig({
          ...config,
          targetVariable: null,
          predictorVariables: [],
          columnTypes: {},
          categoricalColumns: [],
        })
      }

      reader.readAsText(file)
    },
    [parseFileContent, validateScalarFile, spectraFile, config, setScalarFile, setConfig],
  )

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  // Handle drop event
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files)
      }
    },
    [handleFileUpload],
  )

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileUpload(e.target.files)
    },
    [handleFileUpload],
  )

  // Handle target variable selection
  const handleTargetVariableChange = useCallback(
    (value: string) => {
      const newTarget = value === "none" ? null : value
      setConfig({
        ...config,
        targetVariable: newTarget,
        // Remove target from predictors if it was selected
        predictorVariables: config.predictorVariables.filter((v) => v !== value),
      })
    },
    [config, setConfig],
  )

  // Handle predictor variable selection
  const handlePredictorVariableChange = useCallback(
    (value: string, checked: boolean) => {
      if (checked) {
        // Add to predictors if not already there and not the target
        if (!config.predictorVariables.includes(value) && config.targetVariable !== value) {
          setConfig({
            ...config,
            predictorVariables: [...config.predictorVariables, value],
          })
        }
      } else {
        // Remove from predictors
        setConfig({
          ...config,
          predictorVariables: config.predictorVariables.filter((v) => v !== value),
        })
      }
    },
    [config, setConfig],
  )

  // Handle categorical toggle
  const handleCategoricalToggle = useCallback(
    (column: string, isCategorical: boolean) => {
      const newCategoricalColumns = isCategorical
        ? [...config.categoricalColumns, column]
        : config.categoricalColumns.filter((c) => c !== column)

      setConfig({
        ...config,
        categoricalColumns: newCategoricalColumns,
        columnTypes: {
          ...config.columnTypes,
          [column]: isCategorical ? "categorical" : "numeric",
        },
      })

      // Re-validate file if it exists
      if (scalarFile && spectraFile) {
        const updatedConfig = {
          ...config,
          categoricalColumns: newCategoricalColumns,
          columnTypes: {
            ...config.columnTypes,
            [column]: isCategorical ? "categorical" : "numeric",
          },
        }
        const validatedFile = validateScalarFile(scalarFile, spectraFile, updatedConfig)
        setScalarFile(validatedFile)
      }
    },
    [config, setConfig, scalarFile, spectraFile, validateScalarFile, setScalarFile],
  )

  // Handle select all/none predictors
  const handleSelectAllPredictors = useCallback(() => {
    if (!scalarFile) return
    const availablePredictors = scalarFile.headers.filter((h) => h !== config.targetVariable)
    setConfig({
      ...config,
      predictorVariables: availablePredictors,
    })
  }, [scalarFile, config, setConfig])

  const handleSelectNonePredictors = useCallback(() => {
    setConfig({
      ...config,
      predictorVariables: [],
    })
  }, [config, setConfig])

  // Remove file
  const handleRemoveFile = useCallback(() => {
    setScalarFile(null)
    setConfig({
      ...config,
      targetVariable: null,
      predictorVariables: [],
      columnTypes: {},
      categoricalColumns: [],
    })
  }, [config, setConfig, setScalarFile])

  // Update headers
  const handleUpdateHeaders = useCallback(
    (fileType: "spectra" | "frequency" | "scalar", hasHeaders: boolean, headers: string[]) => {
      if (fileType === "scalar" && scalarFile) {
        const updatedFile = { ...scalarFile, hasHeaders, headers }
        if (spectraFile) {
          const validatedFile = validateScalarFile(updatedFile, spectraFile, config)
          setScalarFile(validatedFile)
        } else {
          setScalarFile(updatedFile)
        }

        // Reset configuration
        setConfig({
          ...config,
          targetVariable: null,
          predictorVariables: [],
          columnTypes: {},
          categoricalColumns: [],
        })
      }
    },
    [scalarFile, setScalarFile, spectraFile, config, setConfig, validateScalarFile],
  )

  if (!spectraFile) {
    return (
      <Alert>
        <AlertTitle>No Spectra File</AlertTitle>
        <AlertDescription>Please upload a spectra file in the previous steps.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Scalar Variables (Optional)</h2>
        <p className="text-muted-foreground">
          Upload scalar variables for supervised analysis. This step is optional but required for regression and
          classification.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Scalar Variables File</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-4 w-4" />
                  <span className="sr-only">Help</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>
                  Upload a CSV or TXT file containing scalar variables for supervised analysis. Each row should
                  correspond to a sample (same order as spectra), and each column should be a variable. Mark categorical
                  variables appropriately.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {scalarFile && (
          <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
            <X className="mr-1 h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      {!scalarFile ? (
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragActive ? "border-primary bg-muted/50" : "border-muted-foreground/25"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="mb-4 rounded-full bg-muted p-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <h4 className="mb-1 text-lg font-medium">Drag & Drop your scalar variables file here</h4>
          <p className="mb-4 text-sm text-muted-foreground">or click to browse files</p>
          <input
            id="scalar-file-upload"
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById("scalar-file-upload")?.click()}
            className="mb-2"
          >
            <FileText className="mr-2 h-4 w-4" />
            Select File
          </Button>
          <p className="text-xs text-muted-foreground">Supported formats: CSV, TXT</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Alert variant={scalarFile.isValid ? "default" : "destructive"}>
            <FileText className="h-4 w-4" />
            <AlertTitle>{scalarFile.isValid ? "File Uploaded Successfully" : "File Upload Issues"}</AlertTitle>
            <AlertDescription>
              {scalarFile.name} - {scalarFile.rowCount} rows × {scalarFile.columnCount} columns
              {scalarFile.errors.length > 0 && (
                <div className="mt-2">
                  <strong>Errors:</strong>
                  <ul className="ml-4 list-disc">
                    {scalarFile.errors.map((error, i) => (
                      <li key={i} className="text-sm">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {scalarFile.warnings.length > 0 && (
                <div className="mt-2">
                  <strong>Warnings:</strong>
                  <ul className="ml-4 list-disc">
                    {scalarFile.warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-yellow-600">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>

          <HeaderEditor file={scalarFile} fileType="scalar" onUpdateHeaders={handleUpdateHeaders} />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Data Preview</h3>
            <FilePreview file={scalarFile} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Target Variable</CardTitle>
                <CardDescription>Select the variable you want to predict (for supervised analysis).</CardDescription>
              </CardHeader>
              <CardContent>
                {scalarFile.headers.length > 0 ? (
                  <div className="space-y-4">
                    <Select value={config.targetVariable || "none"} onValueChange={handleTargetVariableChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target variable" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Unsupervised only)</SelectItem>
                        {scalarFile.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header} ({config.categoricalColumns.includes(header) ? "Categorical" : "Numeric"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {config.targetVariable && columnStats[config.targetVariable] && (
                      <div className="rounded-md bg-muted p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {config.categoricalColumns.includes(config.targetVariable) ? (
                            <BarChart3 className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          <span className="font-medium">{config.targetVariable} Statistics</span>
                        </div>
                        {config.categoricalColumns.includes(config.targetVariable) ? (
                          <div className="space-y-1">
                            {Object.entries(columnStats[config.targetVariable].frequencies || {}).map(
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
                            <div>Min: {columnStats[config.targetVariable].min?.toFixed(2)}</div>
                            <div>Max: {columnStats[config.targetVariable].max?.toFixed(2)}</div>
                            <div>Mean: {columnStats[config.targetVariable].mean?.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No headers found in the scalar variables file.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Predictor Variables</CardTitle>
                <CardDescription>Select variables to use as predictors (for supervised analysis).</CardDescription>
              </CardHeader>
              <CardContent>
                {scalarFile.headers.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAllPredictors}>
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSelectNonePredictors}>
                        Select None
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {scalarFile.headers.map((header) => (
                        <div key={header} className="flex items-center space-x-2">
                          <Checkbox
                            id={`predictor-${header}`}
                            checked={config.predictorVariables.includes(header)}
                            disabled={config.targetVariable === header}
                            onCheckedChange={(checked) => handlePredictorVariableChange(header, checked === true)}
                          />
                          <Label
                            htmlFor={`predictor-${header}`}
                            className={`flex-1 ${config.targetVariable === header ? "text-muted-foreground" : ""}`}
                          >
                            {header}
                            {config.targetVariable === header && " (target)"}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({config.categoricalColumns.includes(header) ? "Categorical" : "Numeric"})
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No headers found in the scalar variables file.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Variable Types</CardTitle>
              <CardDescription>
                Mark categorical variables. Categorical variables can contain non-numeric values and will be treated
                differently in analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scalarFile.headers.map((header) => (
                  <div key={header} className="flex items-center justify-between border-b pb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{header}</span>
                        <Switch
                          id={`categorical-${header}`}
                          checked={config.categoricalColumns.includes(header)}
                          onCheckedChange={(checked) => handleCategoricalToggle(header, checked)}
                        />
                        <Label htmlFor={`categorical-${header}`} className="text-sm">
                          Mark as Categorical
                        </Label>
                      </div>
                      {columnStats[header] && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {config.categoricalColumns.includes(header) ? (
                            <div>Categories: {Object.keys(columnStats[header].frequencies || {}).join(", ")}</div>
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
        </div>
      )}

      <div className="rounded-lg bg-muted p-4">
        <h3 className="mb-2 font-medium">File Requirements</h3>
        <ul className="ml-6 list-disc space-y-1 text-sm text-muted-foreground">
          <li>File must be in CSV or TXT format</li>
          <li>Each row corresponds to a sample (same order as spectra)</li>
          <li>Each column is a scalar variable (numeric or categorical)</li>
          <li>Headers are recommended for variable identification</li>
          <li>Must have the same number of data rows as the spectra matrix</li>
          <li>Mark categorical variables using the toggle switches</li>
          <li>Categorical variables can contain non-numeric values</li>
          <li>Numeric variables must contain only numeric values</li>
        </ul>
      </div>
    </div>
  )
}

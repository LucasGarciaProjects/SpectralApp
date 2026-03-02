"use client"

import { useEffect } from "react"
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { FileData, UploadConfig, ValidationStatus } from "@/components/data-upload-module"
import { FilePreview } from "@/components/file-preview"

interface ValidationResultsStepProps {
  spectraFile: FileData | null
  frequencyFile: FileData | null
  scalarFile: FileData | null
  config: UploadConfig
  validationStatus: ValidationStatus
  setValidationStatus: (status: ValidationStatus) => void
  availableModules: {
    unsupervised: boolean
    supervised: boolean
  }
  setAvailableModules: (modules: { unsupervised: boolean; supervised: boolean }) => void
}

export function ValidationResultsStep({
  spectraFile,
  frequencyFile,
  scalarFile,
  config,
  validationStatus,
  setValidationStatus,
  availableModules,
  setAvailableModules,
}: ValidationResultsStepProps) {
  // Validate files when component mounts
  useEffect(() => {
    validateFiles()
  }, [])

  // Validate all files
  const validateFiles = () => {
    // Initialize validation results
    const newValidationStatus: ValidationStatus = {
      spectraFile: null,
      frequencyFile: null,
      scalarFile: null,
      overall: null,
    }

    // Validate spectra file
    if (spectraFile) {
      const spectraValidation = validateSpectraFile(spectraFile)
      newValidationStatus.spectraFile = spectraValidation.isValid
      spectraFile.isValid = spectraValidation.isValid
      spectraFile.errors = spectraValidation.errors
      spectraFile.warnings = spectraValidation.warnings
    }

    // Validate frequency file if needed
    if (config.samplingType === "irregular" && frequencyFile) {
      const frequencyValidation = validateFrequencyFile(frequencyFile, spectraFile)
      newValidationStatus.frequencyFile = frequencyValidation.isValid
      frequencyFile.isValid = frequencyValidation.isValid
      frequencyFile.errors = frequencyValidation.errors
      frequencyFile.warnings = frequencyValidation.warnings
    } else if (config.samplingType === "regular") {
      newValidationStatus.frequencyFile = true // Not needed for regular sampling
    }

    // Validate scalar file if provided
    if (scalarFile) {
      const scalarValidation = validateScalarFile(scalarFile, spectraFile, config)
      newValidationStatus.scalarFile = scalarValidation.isValid
      scalarFile.isValid = scalarValidation.isValid
      scalarFile.errors = scalarValidation.errors
      scalarFile.warnings = scalarValidation.warnings
    } else {
      newValidationStatus.scalarFile = true // Optional file
    }

    // Determine overall validation status
    newValidationStatus.overall =
      newValidationStatus.spectraFile === true &&
      newValidationStatus.frequencyFile !== false &&
      newValidationStatus.scalarFile !== false

    // Determine available modules
    const newAvailableModules = {
      unsupervised: newValidationStatus.spectraFile === true && newValidationStatus.frequencyFile !== false,
      supervised:
        newValidationStatus.spectraFile === true &&
        newValidationStatus.frequencyFile !== false &&
        newValidationStatus.scalarFile === true &&
        scalarFile !== null &&
        config.targetVariable !== null,
    }

    setValidationStatus(newValidationStatus)
    setAvailableModules(newAvailableModules)
  }

  // Validate spectra file
  const validateSpectraFile = (file: FileData) => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    // Parse file content
    const lines = file.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")

    // Determine the separator based on the first line
    const separator = lines[0].includes(";") ? ";" : ","

    // Check if file has at least two rows (header + data)
    if (lines.length < 2) {
      errors.push("File must have at least two rows (one header and one spectrum).")
      isValid = false
    }

    // Check if all rows have the same number of columns
    const columnCounts = lines.map((line) => line.split(separator).length)
    const allSameColumnCount = columnCounts.every((count) => count === columnCounts[0])
    if (!allSameColumnCount) {
      errors.push("All rows must have the same number of columns.")
      isValid = false
    }

    // Check if all values (except header) are numeric
    const dataStartIndex = file.hasHeaders ? 1 : 0
    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = lines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        const value = values[j].trim().replace(",", ".")
        if (isNaN(Number(value))) {
          errors.push(`Non-numeric value found at row ${i + 1}, column ${j + 1}: "${values[j]}".`)
          isValid = false
          break
        }
      }
      if (!isValid) break // Stop checking if we already found an error
    }

    // Check for missing values
    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = lines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        if (values[j].trim() === "") {
          errors.push(`Missing value found at row ${i + 1}, column ${j + 1}.`)
          isValid = false
          break
        }
      }
      if (!isValid) break // Stop checking if we already found an error
    }

    // Check for potential issues
    if (columnCounts[0] < 10) {
      warnings.push("File has fewer than 10 columns. This might indicate a problem with the data format.")
    }

    if (lines.length < 5) {
      warnings.push("File has fewer than 5 rows. This might indicate a problem with the data format.")
    }

    // Check if headers are provided
    if (!file.hasHeaders || file.headers.length === 0) {
      warnings.push("No headers provided. Consider adding headers for better data interpretation.")
    }

    return { isValid, errors, warnings }
  }

  // Validate frequency file
  const validateFrequencyFile = (file: FileData, spectraFile: FileData | null) => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    if (!spectraFile) {
      errors.push("Spectra file is required to validate frequency file.")
      isValid = false
      return { isValid, errors, warnings }
    }

    // Parse file content
    const freqLines = file.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const spectraLines = spectraFile.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")

    // Determine the separator based on the first line
    const separator = freqLines[0].includes(";") ? ";" : ","

    // Check if frequency file has the same number of rows as spectra file
    if (freqLines.length !== spectraLines.length) {
      errors.push(
        `Frequency file has ${freqLines.length} rows, but spectra file has ${spectraLines.length} rows. They must have the same number of rows.`,
      )
      isValid = false
    }

    // Check if all rows have the same number of columns
    const columnCounts = freqLines.map((line) => line.split(separator).length)
    const allSameColumnCount = columnCounts.every((count) => count === columnCounts[0])
    if (!allSameColumnCount) {
      errors.push("All rows in frequency file must have the same number of columns.")
      isValid = false
    }

    // Check if frequency file has the same number of columns as spectra file
    const spectraSeparator = spectraLines[0].includes(";") ? ";" : ","
    const spectraColumnCounts = spectraLines.map((line) => line.split(spectraSeparator).length)
    if (columnCounts[0] !== spectraColumnCounts[0]) {
      errors.push(
        `Frequency file has ${columnCounts[0]} columns, but spectra file has ${spectraColumnCounts[0]} columns. They must have the same number of columns.`,
      )
      isValid = false
    }

    // Check if all values are numeric
    const dataStartIndex = file.hasHeaders ? 1 : 0
    for (let i = dataStartIndex; i < freqLines.length; i++) {
      const values = freqLines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        const value = values[j].trim().replace(",", ".")
        if (isNaN(Number(value))) {
          errors.push(`Non-numeric value found in frequency file at row ${i + 1}, column ${j + 1}: "${values[j]}".`)
          isValid = false
          break
        }
      }
      if (!isValid) break // Stop checking if we already found an error
    }

    // Check for missing values
    for (let i = dataStartIndex; i < freqLines.length; i++) {
      const values = freqLines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        if (values[j].trim() === "") {
          errors.push(`Missing value found in frequency file at row ${i + 1}, column ${j + 1}.`)
          isValid = false
          break
        }
      }
      if (!isValid) break // Stop checking if we already found an error
    }

    return { isValid, errors, warnings }
  }

  // Validate scalar file
  const validateScalarFile = (file: FileData, spectraFile: FileData | null, config: UploadConfig) => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    if (!spectraFile) {
      errors.push("Spectra file is required to validate scalar file.")
      isValid = false
      return { isValid, errors, warnings }
    }

    // Parse file content
    const scalarLines = file.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const spectraLines = spectraFile.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")

    // Determine the separator based on the first line
    const separator = scalarLines[0].includes(";") ? ";" : ","

    // Check if scalar file has a header row
    if (scalarLines.length < 1) {
      errors.push("Scalar file must have at least one row (header).")
      isValid = false
      return { isValid, errors, warnings }
    }

    // Check if scalar file has the same number of rows as spectra file (excluding header)
    const spectraDataRows = spectraFile.hasHeaders ? spectraLines.length - 1 : spectraLines.length
    const scalarDataRows = file.hasHeaders ? scalarLines.length - 1 : scalarLines.length

    if (scalarDataRows !== spectraDataRows) {
      errors.push(
        `Scalar file has ${scalarDataRows} data rows, but spectra file has ${spectraDataRows} data rows. They must have the same number of data rows.`,
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
    const dataStartIndex = file.hasHeaders ? 1 : 0
    for (let i = dataStartIndex; i < scalarLines.length; i++) {
      const values = scalarLines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        if (values[j].trim() === "") {
          errors.push(`Missing value found in scalar file at row ${i + 1}, column ${j + 1}.`)
          isValid = false
          break
        }
      }
      if (!isValid) break // Stop checking if we already found an error
    }

    // Check if numeric columns contain only numeric values
    if (Object.keys(config.columnTypes).length > 0) {
      for (let i = dataStartIndex; i < scalarLines.length; i++) {
        const values = scalarLines[i].split(separator)
        for (let j = 0; j < values.length && j < file.headers.length; j++) {
          const header = file.headers[j]
          const columnType = config.columnTypes[header] || "numeric"

          if (columnType === "numeric") {
            const value = values[j].trim().replace(",", ".")
            if (isNaN(Number(value))) {
              errors.push(`Non-numeric value found in numeric column "${header}" at row ${i + 1}: "${values[j]}".`)
              isValid = false
              break
            }
          }
        }
        if (!isValid) break // Stop checking if we already found an error
      }
    }

    // Check if target variable is selected
    if (!config.targetVariable) {
      warnings.push("No target variable selected. This is required for supervised analysis.")
    }

    // Check if predictor variables are selected
    if (config.predictorVariables.length === 0) {
      warnings.push("No predictor variables selected. This is required for supervised analysis.")
    }

    return { isValid, errors, warnings }
  }

  if (!spectraFile) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Spectra File</AlertTitle>
        <AlertDescription>Please upload a spectra file in the previous steps.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Validation Results</h2>
        <p className="text-muted-foreground">
          Review the validation results for your uploaded files. If all validations pass, you can proceed to analysis.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {validationStatus.spectraFile === true ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : validationStatus.spectraFile === false ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Spectra File
            </CardTitle>
            <CardDescription>
              {validationStatus.spectraFile === true
                ? "Validation passed"
                : validationStatus.spectraFile === false
                  ? "Validation failed"
                  : "Validation in progress"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {spectraFile && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{spectraFile.name}</p>
                {spectraFile.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">Errors:</p>
                    <ul className="ml-6 list-disc text-xs text-destructive">
                      {spectraFile.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {spectraFile.warnings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-500">Warnings:</p>
                    <ul className="ml-6 list-disc text-xs text-yellow-500">
                      {spectraFile.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {config.samplingType === "regular" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : validationStatus.frequencyFile === true ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : validationStatus.frequencyFile === false ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Frequency File
            </CardTitle>
            <CardDescription>
              {config.samplingType === "regular"
                ? "Not required (regular sampling)"
                : validationStatus.frequencyFile === true
                  ? "Validation passed"
                  : validationStatus.frequencyFile === false
                    ? "Validation failed"
                    : "Validation in progress"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config.samplingType === "irregular" && frequencyFile && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{frequencyFile.name}</p>
                {frequencyFile.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">Errors:</p>
                    <ul className="ml-6 list-disc text-xs text-destructive">
                      {frequencyFile.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {frequencyFile.warnings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-500">Warnings:</p>
                    <ul className="ml-6 list-disc text-xs text-yellow-500">
                      {frequencyFile.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {config.samplingType === "irregular" && !frequencyFile && (
              <Alert variant="destructive" className="mt-2">
                <AlertTitle>Missing File</AlertTitle>
                <AlertDescription>Frequency file is required for irregular sampling.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {!scalarFile ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : validationStatus.scalarFile === true ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : validationStatus.scalarFile === false ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Scalar Variables
            </CardTitle>
            <CardDescription>
              {!scalarFile
                ? "Optional (not provided)"
                : validationStatus.scalarFile === true
                  ? "Validation passed"
                  : validationStatus.scalarFile === false
                    ? "Validation failed"
                    : "Validation in progress"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scalarFile && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{scalarFile.name}</p>
                {scalarFile.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">Errors:</p>
                    <ul className="ml-6 list-disc text-xs text-destructive">
                      {scalarFile.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {scalarFile.warnings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-500">Warnings:</p>
                    <ul className="ml-6 list-disc text-xs text-yellow-500">
                      {scalarFile.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {config.targetVariable && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Target Variable: {config.targetVariable}</p>
                    <p className="text-xs text-muted-foreground">
                      Type: {config.columnTypes[config.targetVariable] || "numeric"}
                    </p>
                  </div>
                )}
                {config.predictorVariables.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Predictor Variables:</p>
                    <div className="mt-1 space-y-1">
                      {config.predictorVariables.map((variable) => (
                        <p key={variable} className="text-xs">
                          {variable} ({config.columnTypes[variable] || "numeric"})
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!scalarFile && (
              <Alert className="mt-2">
                <AlertTitle>Optional File</AlertTitle>
                <AlertDescription>
                  Scalar variables are optional but required for supervised analysis (regression/classification).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Alert variant={validationStatus.overall ? "default" : "destructive"}>
        <AlertTitle>{validationStatus.overall ? "Validation Successful" : "Validation Failed"}</AlertTitle>
        <AlertDescription>
          {validationStatus.overall
            ? "All required files have been validated successfully. You can now proceed to analysis."
            : "One or more validations failed. Please fix the errors and try again."}
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="spectra">
        <TabsList>
          <TabsTrigger value="spectra">Spectra File</TabsTrigger>
          {config.samplingType === "irregular" && frequencyFile && (
            <TabsTrigger value="frequency">Frequency File</TabsTrigger>
          )}
          {scalarFile && <TabsTrigger value="scalar">Scalar Variables</TabsTrigger>}
        </TabsList>
        <TabsContent value="spectra" className="space-y-4 pt-4">
          {spectraFile && <FilePreview file={spectraFile} />}
        </TabsContent>
        {config.samplingType === "irregular" && frequencyFile && (
          <TabsContent value="frequency" className="space-y-4 pt-4">
            <FilePreview file={frequencyFile} />
          </TabsContent>
        )}
        {scalarFile && (
          <TabsContent value="scalar" className="space-y-4 pt-4">
            <FilePreview file={scalarFile} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

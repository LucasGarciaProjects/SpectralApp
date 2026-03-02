"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, FileText, Calculator, AlertTriangle, CheckCircle2, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FileData, UploadState, DomainParameters } from "@/components/data-upload-module"

interface SpectralMatrixUploadProps {
  uploadState: UploadState
  onStateUpdate: (updates: Partial<UploadState>) => void
}

export function SpectralMatrixUpload({ uploadState, onStateUpdate }: SpectralMatrixUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [domainParams, setDomainParams] = useState<DomainParameters>({
    startWavelength: 400,
    endWavelength: 700,
    numberOfPoints: 0,
    stepSize: 0,
  })

  const isRegular = uploadState.config.samplingType === "regular"

  // Parse file content
  const parseFileContent = useCallback((file: File, content: string): FileData => {
    const lines = content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const separator = lines[0].includes(";") ? ";" : ","

    const preview: string[][] = []
    for (let i = 0; i < Math.min(3, lines.length); i++) {
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

  // Validate spectral matrix
  const validateSpectralMatrix = useCallback((fileData: FileData): FileData => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    const lines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const separator = lines[0].includes(";") ? ";" : ","

    // Check minimum requirements
    if (lines.length < 2) {
      errors.push("File must have at least 2 rows (header + data)")
      isValid = false
    }

    if (fileData.columnCount < 10) {
      warnings.push("File has fewer than 10 columns. Consider if this is correct for spectral data.")
    }

    // Check data consistency
    const columnCounts = lines.map((line) => line.split(separator).length)
    if (!columnCounts.every((count) => count === columnCounts[0])) {
      errors.push("All rows must have the same number of columns")
      isValid = false
    }

    // Validate numeric data (excluding headers)
    const dataStartIndex = fileData.hasHeaders ? 1 : 0
    for (let i = dataStartIndex; i < Math.min(lines.length, dataStartIndex + 3); i++) {
      const values = lines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        const value = values[j].trim().replace(",", ".")
        if (value !== "" && isNaN(Number(value))) {
          errors.push(`Non-numeric value at row ${i + 1}, column ${j + 1}: "${values[j]}"`)
          isValid = false
          break
        }
      }
      if (!isValid) break
    }

    return { ...fileData, isValid, errors, warnings }
  }, [])

  // Validate frequency matrix
  const validateFrequencyMatrix = useCallback((fileData: FileData, spectralMatrix: FileData): FileData => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    // Check dimensions match
    if (fileData.rowCount !== spectralMatrix.rowCount) {
      errors.push(
        `Frequency matrix has ${fileData.rowCount} rows, but amplitude matrix has ${spectralMatrix.rowCount} rows`,
      )
      isValid = false
    }

    if (fileData.columnCount !== spectralMatrix.columnCount) {
      errors.push(
        `Frequency matrix has ${fileData.columnCount} columns, but amplitude matrix has ${spectralMatrix.columnCount} columns`,
      )
      isValid = false
    }

    // Validate all values are numeric
    const lines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const separator = lines[0].includes(";") ? ";" : ","
    const dataStartIndex = fileData.hasHeaders ? 1 : 0

    for (let i = dataStartIndex; i < Math.min(lines.length, dataStartIndex + 3); i++) {
      const values = lines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        const value = values[j].trim().replace(",", ".")
        if (value !== "" && isNaN(Number(value))) {
          errors.push(`Non-numeric value in frequency matrix at row ${i + 1}, column ${j + 1}: "${values[j]}"`)
          isValid = false
          break
        }
      }
      if (!isValid) break
    }

    return { ...fileData, isValid, errors, warnings }
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(
    (files: FileList | null, fileType: "spectral" | "frequency") => {
      if (!files || files.length === 0) return

      const file = files[0]
      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result as string
        let fileData = parseFileContent(file, content)

        if (fileType === "spectral") {
          fileData = validateSpectralMatrix(fileData)

          // Update domain parameters with column count
          const newDomainParams = { ...domainParams, numberOfPoints: fileData.columnCount }
          const stepSize =
            newDomainParams.numberOfPoints > 1
              ? (newDomainParams.endWavelength - newDomainParams.startWavelength) / (newDomainParams.numberOfPoints - 1)
              : 0

          setDomainParams({ ...newDomainParams, stepSize })

          onStateUpdate({
            spectralMatrix: fileData,
            config: { ...uploadState.config, domainParameters: { ...newDomainParams, stepSize } },
            validationStatus: {
              ...uploadState.validationStatus,
              spectralMatrix: fileData.isValid,
            },
          })
        } else {
          if (uploadState.spectralMatrix) {
            fileData = validateFrequencyMatrix(fileData, uploadState.spectralMatrix)
          }
          onStateUpdate({
            frequencyMatrix: fileData,
            validationStatus: {
              ...uploadState.validationStatus,
              frequencyMatrix: fileData.isValid,
            },
          })
        }
      }

      reader.readAsText(file)
    },
    [parseFileContent, validateSpectralMatrix, validateFrequencyMatrix, uploadState, onStateUpdate, domainParams],
  )

  // Handle domain parameter changes
  const handleDomainChange = useCallback(
    (field: keyof DomainParameters, value: number) => {
      const newParams = { ...domainParams, [field]: value }

      if (field !== "stepSize") {
        const stepSize =
          newParams.numberOfPoints > 1
            ? (newParams.endWavelength - newParams.startWavelength) / (newParams.numberOfPoints - 1)
            : 0
        newParams.stepSize = stepSize
      }

      setDomainParams(newParams)

      // Validate domain parameters
      const isValidDomain =
        newParams.startWavelength < newParams.endWavelength &&
        newParams.numberOfPoints > 0 &&
        (uploadState.spectralMatrix ? newParams.numberOfPoints === uploadState.spectralMatrix.columnCount : true)

      onStateUpdate({
        config: { ...uploadState.config, domainParameters: newParams },
        validationStatus: {
          ...uploadState.validationStatus,
          domainParameters: isValidDomain,
        },
      })
    },
    [domainParams, uploadState, onStateUpdate],
  )

  // Handle header toggle
  const handleHeaderToggle = useCallback(
    (fileType: "spectral" | "frequency", hasHeaders: boolean) => {
      const targetFile = fileType === "spectral" ? uploadState.spectralMatrix : uploadState.frequencyMatrix
      if (!targetFile) return

      const updatedFile = { ...targetFile, hasHeaders }

      // Auto-generate headers if disabled
      if (!hasHeaders) {
        updatedFile.headers = Array.from({ length: targetFile.columnCount }, (_, i) => `W${i + 1}`)
      } else {
        updatedFile.headers = targetFile.preview[0] || []
      }

      if (fileType === "spectral") {
        onStateUpdate({ spectralMatrix: updatedFile })
      } else {
        onStateUpdate({ frequencyMatrix: updatedFile })
      }
    },
    [uploadState, onStateUpdate],
  )

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, fileType: "spectral" | "frequency") => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files?.length > 0) {
        handleFileUpload(e.dataTransfer.files, fileType)
      }
    },
    [handleFileUpload],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">
          {isRegular ? "Upload Spectral Matrix" : "Upload Amplitude & Frequency Matrices"}
        </h2>
        <p className="text-muted-foreground">
          {isRegular
            ? "Upload your spectral data file and configure the wavelength domain parameters."
            : "Upload both amplitude and frequency matrices. Both files must have identical dimensions."}
        </p>
      </div>

      {isRegular ? (
        // Regular Sampling Layout
        <div className="grid gap-6 lg:grid-cols-2">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Spectral Matrix File</CardTitle>
              <CardDescription>Upload your CSV or TXT file containing spectral data</CardDescription>
            </CardHeader>
            <CardContent>
              {!uploadState.spectralMatrix ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={(e) => handleDrop(e, "spectral")}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">Drop your file here</p>
                  <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    id="spectral-upload"
                    onChange={(e) => handleFileUpload(e.target.files, "spectral")}
                  />
                  <Button variant="outline" onClick={() => document.getElementById("spectral-upload")?.click()}>
                    <FileText className="mr-2 h-4 w-4" />
                    Select File
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert variant={uploadState.spectralMatrix.isValid ? "default" : "destructive"}>
                    <FileText className="h-4 w-4" />
                    <AlertTitle>
                      {uploadState.spectralMatrix.isValid ? "File Uploaded Successfully" : "File Issues Detected"}
                    </AlertTitle>
                    <AlertDescription>
                      {uploadState.spectralMatrix.name} - {uploadState.spectralMatrix.rowCount} rows ×{" "}
                      {uploadState.spectralMatrix.columnCount} columns
                    </AlertDescription>
                  </Alert>

                  {/* Header Toggle */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="headers-toggle"
                      checked={uploadState.spectralMatrix.hasHeaders}
                      onCheckedChange={(checked) => handleHeaderToggle("spectral", checked)}
                    />
                    <Label htmlFor="headers-toggle">First row contains headers</Label>
                  </div>

                  {/* File Preview */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Preview (first 3 rows)</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {uploadState.spectralMatrix.preview.map((row, i) => (
                            <tr
                              key={i}
                              className={
                                i === 0 && uploadState.spectralMatrix?.hasHeaders ? "font-medium bg-gray-50" : ""
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
                  {uploadState.spectralMatrix.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Errors</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside">
                          {uploadState.spectralMatrix.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {uploadState.spectralMatrix.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warnings</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside">
                          {uploadState.spectralMatrix.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button variant="outline" size="sm" onClick={() => onStateUpdate({ spectralMatrix: null })}>
                    <X className="mr-1 h-4 w-4" />
                    Remove File
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Domain Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>Domain Parameters</CardTitle>
              <CardDescription>Specify the wavelength range for your spectral data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-wavelength">Start Wavelength</Label>
                  <Input
                    id="start-wavelength"
                    type="number"
                    value={domainParams.startWavelength}
                    onChange={(e) => handleDomainChange("startWavelength", Number(e.target.value))}
                    placeholder="400"
                  />
                </div>
                <div>
                  <Label htmlFor="end-wavelength">End Wavelength</Label>
                  <Input
                    id="end-wavelength"
                    type="number"
                    value={domainParams.endWavelength}
                    onChange={(e) => handleDomainChange("endWavelength", Number(e.target.value))}
                    placeholder="700"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="num-points">Number of Points</Label>
                <Input
                  id="num-points"
                  type="number"
                  value={domainParams.numberOfPoints}
                  onChange={(e) => handleDomainChange("numberOfPoints", Number(e.target.value))}
                  placeholder="Auto-detected from file"
                  disabled={!!uploadState.spectralMatrix}
                />
                {uploadState.spectralMatrix && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-detected: {uploadState.spectralMatrix.columnCount} columns
                  </p>
                )}
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4" />
                  <span className="font-medium text-sm">Calculated Step Size</span>
                </div>
                <p className="text-lg font-mono">Δλ = {domainParams.stepSize.toFixed(4)} nm</p>
                <p className="text-xs text-muted-foreground">
                  ({domainParams.endWavelength} - {domainParams.startWavelength}) / ({domainParams.numberOfPoints} - 1)
                </p>
              </div>

              {/* Validation Status */}
              {uploadState.validationStatus.domainParameters !== null && (
                <Alert variant={uploadState.validationStatus.domainParameters ? "default" : "destructive"}>
                  {uploadState.validationStatus.domainParameters ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {uploadState.validationStatus.domainParameters ? "Parameters Valid" : "Parameter Issues"}
                  </AlertTitle>
                  <AlertDescription>
                    {uploadState.validationStatus.domainParameters
                      ? "Domain parameters are correctly configured."
                      : "Please check that start < end wavelength and number of points matches your data."}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Irregular Sampling Layout
        <Tabs defaultValue="amplitude" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="amplitude">Amplitude Matrix</TabsTrigger>
            <TabsTrigger value="frequency">Frequency Matrix</TabsTrigger>
          </TabsList>

          <TabsContent value="amplitude" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Amplitude Matrix</CardTitle>
                <CardDescription>Upload the main spectral amplitude data</CardDescription>
              </CardHeader>
              <CardContent>
                {!uploadState.spectralMatrix ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={(e) => handleDrop(e, "spectral")}
                  >
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium mb-2">Drop amplitude matrix here</p>
                    <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      id="amplitude-upload"
                      onChange={(e) => handleFileUpload(e.target.files, "spectral")}
                    />
                    <Button variant="outline" onClick={() => document.getElementById("amplitude-upload")?.click()}>
                      <FileText className="mr-2 h-4 w-4" />
                      Select Amplitude File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert variant={uploadState.spectralMatrix.isValid ? "default" : "destructive"}>
                      <FileText className="h-4 w-4" />
                      <AlertTitle>Amplitude Matrix Uploaded</AlertTitle>
                      <AlertDescription>
                        {uploadState.spectralMatrix.name} - {uploadState.spectralMatrix.rowCount} rows ×{" "}
                        {uploadState.spectralMatrix.columnCount} columns
                      </AlertDescription>
                    </Alert>

                    {/* Header Toggle */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="amplitude-headers"
                        checked={uploadState.spectralMatrix.hasHeaders}
                        onCheckedChange={(checked) => handleHeaderToggle("spectral", checked)}
                      />
                      <Label htmlFor="amplitude-headers">First row contains headers</Label>
                    </div>

                    {/* Preview and errors (similar to regular sampling) */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Preview (first 3 rows)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {uploadState.spectralMatrix.preview.map((row, i) => (
                              <tr
                                key={i}
                                className={
                                  i === 0 && uploadState.spectralMatrix?.hasHeaders ? "font-medium bg-gray-50" : ""
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="frequency" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Frequency Matrix</CardTitle>
                <CardDescription>
                  Upload the corresponding frequency data (same dimensions as amplitude)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!uploadState.spectralMatrix ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Upload Amplitude Matrix First</AlertTitle>
                    <AlertDescription>
                      Please upload the amplitude matrix before uploading the frequency matrix.
                    </AlertDescription>
                  </Alert>
                ) : !uploadState.frequencyMatrix ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={(e) => handleDrop(e, "frequency")}
                  >
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium mb-2">Drop frequency matrix here</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Must have {uploadState.spectralMatrix.rowCount} rows × {uploadState.spectralMatrix.columnCount}{" "}
                      columns
                    </p>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      id="frequency-upload"
                      onChange={(e) => handleFileUpload(e.target.files, "frequency")}
                    />
                    <Button variant="outline" onClick={() => document.getElementById("frequency-upload")?.click()}>
                      <FileText className="mr-2 h-4 w-4" />
                      Select Frequency File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert variant={uploadState.frequencyMatrix.isValid ? "default" : "destructive"}>
                      <FileText className="h-4 w-4" />
                      <AlertTitle>Frequency Matrix Uploaded</AlertTitle>
                      <AlertDescription>
                        {uploadState.frequencyMatrix.name} - {uploadState.frequencyMatrix.rowCount} rows ×{" "}
                        {uploadState.frequencyMatrix.columnCount} columns
                      </AlertDescription>
                    </Alert>

                    {/* Header Toggle */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="frequency-headers"
                        checked={uploadState.frequencyMatrix.hasHeaders}
                        onCheckedChange={(checked) => handleHeaderToggle("frequency", checked)}
                      />
                      <Label htmlFor="frequency-headers">First row contains headers</Label>
                    </div>

                    {/* Preview */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Preview (first 3 rows)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {uploadState.frequencyMatrix.preview.map((row, i) => (
                              <tr
                                key={i}
                                className={
                                  i === 0 && uploadState.frequencyMatrix?.hasHeaders ? "font-medium bg-gray-50" : ""
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

                    {/* Errors */}
                    {uploadState.frequencyMatrix.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Errors</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {uploadState.frequencyMatrix.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Requirements Box */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-medium mb-2">📋 File Requirements</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• CSV or TXT format with comma/semicolon separators</li>
          <li>• Rows = spectra (samples), Columns = wavelengths/frequencies</li>
          <li>• All data values must be numeric (headers can be text)</li>
          <li>• Minimum 2 rows and 10 columns recommended</li>
          {!isRegular && <li>• Frequency matrix must have identical dimensions to amplitude matrix</li>}
        </ul>
      </div>
    </div>
  )
}

"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { FileText, HelpCircle, Upload, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import type { FileData, UploadConfig } from "@/components/data-upload-module"
import { FilePreview } from "@/components/file-preview"
import { HeaderEditor } from "@/components/header-editor"

interface FileUploadStepProps {
  spectraFile: FileData | null
  setSpectraFile: (file: FileData | null) => void
  frequencyFile: FileData | null
  setFrequencyFile: (file: FileData | null) => void
  config: UploadConfig
  setConfig: (config: UploadConfig) => void
}

export function FileUploadStep({
  spectraFile,
  setSpectraFile,
  frequencyFile,
  setFrequencyFile,
  config,
  setConfig,
}: FileUploadStepProps) {
  const [activeTab, setActiveTab] = useState("spectra")
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

  // Validate spectral file
  const validateSpectralFile = useCallback((fileData: FileData): FileData => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    const lines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const separator = lines[0].includes(";") ? ";" : ","

    // Check minimum requirements
    if (lines.length < 2) {
      errors.push("File must have at least two rows (header and data).")
      isValid = false
    }

    // Check if all rows have the same number of columns
    const columnCounts = lines.map((line) => line.split(separator).length)
    const allSameColumnCount = columnCounts.every((count) => count === columnCounts[0])
    if (!allSameColumnCount) {
      errors.push("All rows must have the same number of columns.")
      isValid = false
    }

    // Check if data rows (excluding header) are numeric
    const dataStartIndex = fileData.hasHeaders ? 1 : 0
    for (let i = dataStartIndex; i < Math.min(lines.length, dataStartIndex + 5); i++) {
      const values = lines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        const value = values[j].trim().replace(",", ".")
        if (value !== "" && isNaN(Number(value))) {
          errors.push(`Non-numeric value in spectral matrix at row ${i + 1}, column ${j + 1}: "${values[j]}"`)
          isValid = false
          break
        }
      }
      if (!isValid) break
    }

    // Check for missing values in data rows
    for (let i = dataStartIndex; i < Math.min(lines.length, dataStartIndex + 5); i++) {
      const values = lines[i].split(separator)
      for (let j = 0; j < values.length; j++) {
        if (values[j].trim() === "") {
          errors.push(`Missing value found at row ${i + 1}, column ${j + 1}.`)
          isValid = false
          break
        }
      }
      if (!isValid) break
    }

    // Warnings
    if (columnCounts[0] < 10) {
      warnings.push("File has fewer than 10 columns. This might indicate a problem with the data format.")
    }

    if (lines.length < 5) {
      warnings.push("File has fewer than 5 rows. This might indicate a problem with the data format.")
    }

    return {
      ...fileData,
      isValid,
      errors,
      warnings,
    }
  }, [])

  // Validate frequency file
  const validateFrequencyFile = useCallback((fileData: FileData, spectraFile: FileData): FileData => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    const freqLines = fileData.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const spectraLines = spectraFile.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")
    const separator = freqLines[0].includes(";") ? ";" : ","

    // Check dimensions match
    if (freqLines.length !== spectraLines.length) {
      errors.push(
        `Frequency matrix has ${freqLines.length} rows, but spectra matrix has ${spectraLines.length} rows. They must match.`,
      )
      isValid = false
    }

    const freqColumnCount = freqLines[0] ? freqLines[0].split(separator).length : 0
    const spectraColumnCount = spectraLines[0] ? spectraLines[0].split(separator).length : 0
    if (freqColumnCount !== spectraColumnCount) {
      errors.push(
        `Frequency matrix has ${freqColumnCount} columns, but spectra matrix has ${spectraColumnCount} columns. They must match.`,
      )
      isValid = false
    }

    // Check if all values are numeric
    const dataStartIndex = fileData.hasHeaders ? 1 : 0
    for (let i = dataStartIndex; i < Math.min(freqLines.length, dataStartIndex + 5); i++) {
      const values = freqLines[i].split(separator)
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

    return {
      ...fileData,
      isValid,
      errors,
      warnings,
    }
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(
    (files: FileList | null, fileType: "spectra" | "frequency") => {
      if (!files || files.length === 0) return

      const file = files[0]
      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result as string
        let fileData = parseFileContent(file, content)

        if (fileType === "spectra") {
          fileData = validateSpectralFile(fileData)
          setSpectraFile(fileData)
        } else {
          if (spectraFile) {
            fileData = validateFrequencyFile(fileData, spectraFile)
          }
          setFrequencyFile(fileData)
        }
      }

      reader.readAsText(file)
    },
    [parseFileContent, validateSpectralFile, validateFrequencyFile, spectraFile, setSpectraFile, setFrequencyFile],
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
        handleFileUpload(e.dataTransfer.files, activeTab as "spectra" | "frequency")
      }
    },
    [activeTab, handleFileUpload],
  )

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileUpload(e.target.files, activeTab as "spectra" | "frequency")
    },
    [activeTab, handleFileUpload],
  )

  // Remove file
  const handleRemoveFile = useCallback(
    (fileType: "spectra" | "frequency") => {
      if (fileType === "spectra") {
        setSpectraFile(null)
      } else {
        setFrequencyFile(null)
      }
    },
    [setSpectraFile, setFrequencyFile],
  )

  // Update headers
  const handleUpdateHeaders = useCallback(
    (fileType: "spectra" | "frequency", hasHeaders: boolean, headers: string[]) => {
      if (fileType === "spectra" && spectraFile) {
        const updatedFile = { ...spectraFile, hasHeaders, headers }
        const validatedFile = validateSpectralFile(updatedFile)
        setSpectraFile(validatedFile)
      } else if (fileType === "frequency" && frequencyFile) {
        const updatedFile = { ...frequencyFile, hasHeaders, headers }
        if (spectraFile) {
          const validatedFile = validateFrequencyFile(updatedFile, spectraFile)
          setFrequencyFile(validatedFile)
        } else {
          setFrequencyFile(updatedFile)
        }
      }
    },
    [spectraFile, frequencyFile, setSpectraFile, setFrequencyFile, validateSpectralFile, validateFrequencyFile],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Upload Spectral Data Files</h2>
        <p className="text-muted-foreground">
          Upload your spectral data files in CSV or TXT format. The system will validate the files and guide you through
          the configuration process.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="spectra">Spectra Matrix</TabsTrigger>
          <TabsTrigger
            value="frequency"
            disabled={config.samplingType === "regular"}
            className={config.samplingType === "irregular" ? "bg-blue-50" : ""}
          >
            Frequency Matrix
            {config.samplingType === "irregular" && " (Required)"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spectra" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">Spectra Matrix</h3>
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
                      Upload a CSV or TXT file containing your spectral data. Each row represents a spectrum (sample),
                      and each column represents an amplitude value at a specific wavelength/frequency. Headers are
                      recommended for better data interpretation.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {spectraFile && (
              <Button variant="ghost" size="sm" onClick={() => handleRemoveFile("spectra")}>
                <X className="mr-1 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>

          {!spectraFile ? (
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
              <h4 className="mb-1 text-lg font-medium">Drag & Drop your spectral matrix file here</h4>
              <p className="mb-4 text-sm text-muted-foreground">or click to browse files</p>
              <input
                id="spectra-file-upload"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("spectra-file-upload")?.click()}
                className="mb-2"
              >
                <FileText className="mr-2 h-4 w-4" />
                Select File
              </Button>
              <p className="text-xs text-muted-foreground">Supported formats: CSV, TXT</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert variant={spectraFile.isValid ? "default" : "destructive"}>
                <FileText className="h-4 w-4" />
                <AlertTitle>{spectraFile.isValid ? "File Uploaded Successfully" : "File Upload Issues"}</AlertTitle>
                <AlertDescription>
                  {spectraFile.name} - {spectraFile.rowCount} rows × {spectraFile.columnCount} columns
                  {spectraFile.errors.length > 0 && (
                    <div className="mt-2">
                      <strong>Errors:</strong>
                      <ul className="ml-4 list-disc">
                        {spectraFile.errors.map((error, i) => (
                          <li key={i} className="text-sm">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {spectraFile.warnings.length > 0 && (
                    <div className="mt-2">
                      <strong>Warnings:</strong>
                      <ul className="ml-4 list-disc">
                        {spectraFile.warnings.map((warning, i) => (
                          <li key={i} className="text-sm text-yellow-600">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              <HeaderEditor file={spectraFile} fileType="spectra" onUpdateHeaders={handleUpdateHeaders} />

              <FilePreview file={spectraFile} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="frequency" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">Frequency Matrix</h3>
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
                      For irregularly sampled data, upload a frequency matrix with the same dimensions as your spectra
                      matrix. Each value should be the frequency/wavelength corresponding to the amplitude in the
                      spectra matrix.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {frequencyFile && (
              <Button variant="ghost" size="sm" onClick={() => handleRemoveFile("frequency")}>
                <X className="mr-1 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>

          {config.samplingType === "irregular" ? (
            !frequencyFile ? (
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
                <h4 className="mb-1 text-lg font-medium">Drag & Drop your frequency matrix file here</h4>
                <p className="mb-4 text-sm text-muted-foreground">or click to browse files</p>
                <input
                  id="frequency-file-upload"
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("frequency-file-upload")?.click()}
                  className="mb-2"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Select File
                </Button>
                <p className="text-xs text-muted-foreground">Supported formats: CSV, TXT</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant={frequencyFile.isValid ? "default" : "destructive"}>
                  <FileText className="h-4 w-4" />
                  <AlertTitle>{frequencyFile.isValid ? "File Uploaded Successfully" : "File Upload Issues"}</AlertTitle>
                  <AlertDescription>
                    {frequencyFile.name} - {frequencyFile.rowCount} rows × {frequencyFile.columnCount} columns
                    {frequencyFile.errors.length > 0 && (
                      <div className="mt-2">
                        <strong>Errors:</strong>
                        <ul className="ml-4 list-disc">
                          {frequencyFile.errors.map((error, i) => (
                            <li key={i} className="text-sm">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>

                <HeaderEditor file={frequencyFile} fileType="frequency" onUpdateHeaders={handleUpdateHeaders} />

                <FilePreview file={frequencyFile} />
              </div>
            )
          ) : (
            <Alert>
              <AlertTitle>Regular Sampling Selected</AlertTitle>
              <AlertDescription>
                You have selected regular sampling in the configuration. Frequency matrix upload is not required.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      <div className="rounded-lg bg-muted p-4">
        <h3 className="mb-2 font-medium">File Requirements</h3>
        <ul className="ml-6 list-disc space-y-1 text-sm text-muted-foreground">
          <li>File must be in CSV or TXT format</li>
          <li>Each row represents a spectrum (sample)</li>
          <li>Each column represents an amplitude value at a specific wavelength/frequency</li>
          <li>Headers are recommended for better data interpretation</li>
          <li>All data values (excluding headers) must be numeric</li>
          <li>All rows must have the same number of columns</li>
          <li>For irregular sampling, frequency matrix must have the same dimensions as spectra matrix</li>
        </ul>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import type { FileData } from "@/components/data-upload-module"

interface HeaderEditorProps {
  file: FileData
  fileType: "spectra" | "frequency" | "scalar"
  onUpdateHeaders: (fileType: "spectra" | "frequency" | "scalar", hasHeaders: boolean, headers: string[]) => void
}

export function HeaderEditor({ file, fileType, onUpdateHeaders }: HeaderEditorProps) {
  const [hasHeaders, setHasHeaders] = useState(file.hasHeaders)
  const [headers, setHeaders] = useState<string[]>(file.headers)

  // Update parent immediately when changes are made
  useEffect(() => {
    onUpdateHeaders(fileType, hasHeaders, headers)
  }, [hasHeaders, headers, fileType, onUpdateHeaders])

  // Generate default headers based on file type
  const generateDefaultHeaders = (count: number) => {
    if (fileType === "spectra") {
      return Array.from({ length: count }, (_, i) => `W${i + 1}`)
    } else if (fileType === "frequency") {
      return Array.from({ length: count }, (_, i) => `F${i + 1}`)
    } else {
      return Array.from({ length: count }, (_, i) => `Var${i + 1}`)
    }
  }

  // Handle header change
  const handleHeaderChange = (index: number, value: string) => {
    const newHeaders = [...headers]
    newHeaders[index] = value
    setHeaders(newHeaders)
  }

  // Handle has headers toggle
  const handleHasHeadersToggle = (checked: boolean) => {
    setHasHeaders(checked)

    if (!checked && file.preview.length > 0) {
      // If no headers, generate default headers
      const columnCount = file.preview[0].length
      const defaultHeaders = generateDefaultHeaders(columnCount)
      setHeaders(defaultHeaders)
    } else if (checked && file.preview.length > 0) {
      // If has headers, use the first row as headers
      setHeaders([...file.preview[0]])
    }
  }

  // Reset to auto-generated headers
  const handleResetHeaders = () => {
    if (file.preview.length > 0) {
      const columnCount = file.preview[0].length
      const defaultHeaders = generateDefaultHeaders(columnCount)
      setHeaders(defaultHeaders)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md">Column Headers Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id="has-headers" checked={hasHeaders} onCheckedChange={handleHasHeadersToggle} />
            <Label htmlFor="has-headers">First row contains headers</Label>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Column Names</Label>
              <Button variant="outline" size="sm" onClick={handleResetHeaders}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Reset to Default
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {headers.map((header, index) => (
                <div key={index} className="space-y-1">
                  <Label htmlFor={`header-${index}`} className="text-xs">
                    Col {index + 1}
                  </Label>
                  <Input
                    id={`header-${index}`}
                    value={header}
                    onChange={(e) => handleHeaderChange(index, e.target.value)}
                    className="h-8"
                    placeholder={generateDefaultHeaders(headers.length)[index]}
                  />
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {fileType === "spectra" &&
                "Tip: Use wavelength values (e.g., 400, 401, 402...) or descriptive names (e.g., W400, W401, W402...)"}
              {fileType === "frequency" && "Tip: Use frequency values that correspond to your spectra matrix"}
              {fileType === "scalar" && "Tip: Use descriptive variable names (e.g., Temperature, pH, Concentration...)"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

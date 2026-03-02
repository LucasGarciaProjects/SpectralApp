/**
 * Componente de Vista de Carga de Datos
 * 
 * Este componente gestiona la carga inicial de datos y configuración para
 * análisis espectral. Proporciona funcionalidad para:
 * - Subir archivos de datos espectrales (CSV, TXT)
 * - Subir archivos de datos escalares/covariables
 * - Detección y validación de formato de archivo
 * - Configuración de parsing de datos (separadores, headers, etc.)
 * - Vista previa y validación de datos antes del procesamiento
 * - Integración con el estado global de la aplicación
 */

"use client"

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Settings, CheckCircle, AlertCircle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

import { useAppState } from '@/hooks/useAppState'
import { 
  parseSpectralMatrix, 
  parseScalarMatrix, 
  getFilePreview,
  validateFileContent,
  detectSeparator,
  detectDecimalSeparator,
  detectHeaders,
  validateParsingOptions,
  type ParseOptions
} from '@/lib/data-utils'

interface FileUploadState {
  file: File | null
  content: string
  preview: string[][]
  isValid: boolean
  error?: string
  isUploaded: boolean
  warnings?: string[]
}

export function UploadView() {
  const router = useRouter()
  const { 
    rawData, 
    scalarData, 
    settings, 
    setRawData, 
    setScalarData, 
    updateSettings, 
    resetAll 
  } = useAppState()

  const [spectralFile, setSpectralFile] = useState<FileUploadState>({
    file: null,
    content: '',
    preview: [],
    isValid: false,
    isUploaded: false
  })

  const [scalarFile, setScalarFile] = useState<FileUploadState>({
    file: null,
    content: '',
    preview: [],
    isValid: false,
    isUploaded: false
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // Store original file info when data is first loaded
  const [originalFileInfo, setOriginalFileInfo] = useState<{
    file: File | null
    content: string
    preview: string[][]
    warnings: string[]
  } | null>(null)

  // Update preview when settings change
  const updatePreview = useCallback((content: string, currentSettings: typeof settings) => {
    try {
      const preview = getFilePreview(content, currentSettings, 5)
      const validation = validateParsingOptions(content, currentSettings)
      
      setPreviewWarnings(validation.warnings)
      
      return { preview, warnings: validation.warnings }
    } catch (error) {
      setPreviewWarnings([`Preview error: ${error instanceof Error ? error.message : 'Unknown error'}`])
      return { preview: [], warnings: [`Preview error: ${error instanceof Error ? error.message : 'Unknown error'}`] }
    }
  }, [])

  // Restore preview when returning to upload section
  useEffect(() => {
    if (rawData && !spectralFile.file && !scalarFile.file && originalFileInfo) {
      // User has data but no file state - restore from stored original info
      setSpectralFile({
        file: originalFileInfo.file,
        content: originalFileInfo.content,
        preview: originalFileInfo.preview,
        isValid: true,
        isUploaded: true,
        warnings: originalFileInfo.warnings
      })
      // Also restore the data loaded state
      setDataLoaded(true)
    }
  }, [rawData, spectralFile.file, scalarFile.file, originalFileInfo])


  // Handle file upload
  const handleFileUpload = useCallback(async (
    file: File, 
    type: 'spectral' | 'scalar'
  ) => {
    setIsProcessing(true)
    
    try {
      const content = await file.text()
      
      // Validate content
      const validation = validateFileContent(content)
      if (!validation.isValid) {
        throw new Error(validation.error)
      }

      // Auto-detect settings if this is the first file
      let currentSettings = settings
      if (!spectralFile.file && !scalarFile.file) {
        const detectedColSeparator = detectSeparator(content)
        const detectedDecSeparator = detectDecimalSeparator(content)
        const detectedHeaders = detectHeaders(content, detectedColSeparator)
        
        currentSettings = {
          columnSeparator: detectedColSeparator,
          decimalSeparator: detectedDecSeparator,
          hasHeaders: detectedHeaders
        }
        
        updateSettings(currentSettings)
      }

      // Generate preview with validation using current settings
      const { preview, warnings } = updatePreview(content, currentSettings)

      const fileState: FileUploadState = {
        file,
        content,
        preview,
        isValid: true,
        isUploaded: false,
        warnings
      }

      if (type === 'spectral') {
        setSpectralFile(fileState)
      } else {
        setScalarFile(fileState)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const fileState: FileUploadState = {
        file,
        content: '',
        preview: [],
        isValid: false,
        error: errorMessage,
        isUploaded: false
      }

      if (type === 'spectral') {
        setSpectralFile(fileState)
      } else {
        setScalarFile(fileState)
      }
    } finally {
      setIsProcessing(false)
    }
  }, [settings, spectralFile.file, scalarFile.file, updateSettings, updatePreview])

  // Handle settings change with immediate preview update
  const handleSettingsChange = useCallback((newSettings: Partial<typeof settings>) => {
    updateSettings(newSettings)
    
    // Update preview for spectral file if it exists
    if (spectralFile.content) {
      const updatedSettings = { ...settings, ...newSettings }
      const { preview, warnings } = updatePreview(spectralFile.content, updatedSettings)
      setSpectralFile(prev => ({ ...prev, preview, warnings }))
    }
    
    // Update preview for scalar file if it exists
    if (scalarFile.content) {
      const updatedSettings = { ...settings, ...newSettings }
      const { preview, warnings } = updatePreview(scalarFile.content, updatedSettings)
      setScalarFile(prev => ({ ...prev, preview, warnings }))
    }
  }, [settings, spectralFile.content, scalarFile.content, updateSettings, updatePreview])

  // Process and upload data to state
  const processFiles = useCallback(async () => {
    if (!spectralFile.file || !spectralFile.isValid) return

    setIsProcessing(true)

    try {
      const parseOptions: ParseOptions = settings

      // Parse spectral data
      const spectralMatrix = parseSpectralMatrix(spectralFile.content, parseOptions)
      setRawData(spectralMatrix)
      setSpectralFile(prev => ({ ...prev, isUploaded: true }))

      // Store original file info for restoration
      setOriginalFileInfo({
        file: spectralFile.file,
        content: spectralFile.content,
        preview: spectralFile.preview,
        warnings: spectralFile.warnings || []
      })

      // Mark data as loaded
      setDataLoaded(true)

      // Parse scalar data if provided
      if (scalarFile.file && scalarFile.isValid) {
        const scalarMatrix = parseScalarMatrix(scalarFile.content, parseOptions)
        setScalarData(scalarMatrix)
        setScalarFile(prev => ({ ...prev, isUploaded: true }))
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing error'
      
      if (spectralFile.file) {
        setSpectralFile(prev => ({ ...prev, error: errorMessage, isValid: false }))
      }
      
      if (scalarFile.file) {
        setScalarFile(prev => ({ ...prev, error: errorMessage, isValid: false }))
      }
    } finally {
      setIsProcessing(false)
    }
  }, [spectralFile, scalarFile, settings, setRawData, setScalarData])

  // Clear a file
  const clearFile = useCallback((type: 'spectral' | 'scalar') => {
    if (type === 'spectral') {
      setSpectralFile({
        file: null,
        content: '',
        preview: [],
        isValid: false,
        isUploaded: false
      })
    } else {
      setScalarFile({
        file: null,
        content: '',
        preview: [],
        isValid: false,
        isUploaded: false
      })
    }
  }, [])

  const canProcess = spectralFile.file && spectralFile.isValid && !isProcessing
  const hasUploadedData = rawData !== null

  // Handle proceed to domain configuration
  const handleProceedToDomain = () => {
    router.push('/domain')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Upload</h1>
          <p className="text-muted-foreground">
            Upload your spectral data and configure parsing settings
          </p>
        </div>
        
        {hasUploadedData && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Data Loaded
            </Badge>
            <Button variant="outline" size="sm" onClick={() => {
              resetAll()
              setDataLoaded(false)
              setOriginalFileInfo(null)
            }}>
              Reset All
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* File Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Solo se permite subir datos espectrales */}
          <div>
            <h3 className="font-medium mb-2">Spectral Data (Required)</h3>
            <FileUploadCard
              title="Spectral Matrix"
              description="Upload CSV/TXT file containing spectral data (samples × wavelengths)"
              fileState={spectralFile}
              onFileUpload={(file) => handleFileUpload(file, 'spectral')}
              onClear={() => clearFile('spectral')}
              isProcessing={isProcessing}
              required
            />
          </div>
        </div>

        {/* Settings Section */}
        <div>
          <SettingsCard settings={settings} onUpdateSettings={handleSettingsChange} />
        </div>
      </div>

      {/* Data Preview */}
      {spectralFile.preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Spectral Data Preview</CardTitle>
            <CardDescription>
              Preview of uploaded spectral data with current settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Warnings */}
            {(spectralFile.warnings && spectralFile.warnings.length > 0) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Warning: current settings may not be correct for this dataset.</p>
                    <ul className="list-disc list-inside space-y-1">
                      {spectralFile.warnings.map((warning, index) => (
                        <li key={index} className="text-sm">{warning}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <DataPreview data={spectralFile.preview} />
          </CardContent>
        </Card>
      )}

      {/* Process Button */}
      {canProcess && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Ready to Process</h3>
                <p className="text-sm text-muted-foreground">
                  Files validated and ready to be loaded into the application
                </p>
              </div>
              <Button 
                onClick={dataLoaded ? handleProceedToDomain : processFiles} 
                disabled={isProcessing}
                className={dataLoaded ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {isProcessing ? 'Processing...' : dataLoaded ? 'Proceed to Configure Domain' : 'Load Data'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Summary */}
      {hasUploadedData && (
        <Card>
          <CardHeader>
            <CardTitle>Data Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium">Spectral Data</Label>
                <p className="text-sm text-muted-foreground">
                  {rawData?.length || 0} samples × {rawData?.[0]?.length || 0} wavelengths
                </p>
              </div>
              {scalarData && (
                <div>
                  <Label className="text-sm font-medium">Scalar Variables</Label>
                  <p className="text-sm text-muted-foreground">
                    {scalarData.length || 0} samples × {Object.keys(scalarData[0] || {}).length} variables
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// File Upload Card Component
interface FileUploadCardProps {
  title: string
  description: string
  fileState: FileUploadState
  onFileUpload: (file: File) => void
  onClear: () => void
  isProcessing: boolean
  required?: boolean
}

function FileUploadCard({
  title,
  description,
  fileState,
  onFileUpload,
  onClear,
  isProcessing,
  required = false
}: FileUploadCardProps) {
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onFileUpload(file)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {required && <Badge variant="destructive" size="sm">Required</Badge>}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fileState.file ? (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <div className="space-y-2">
              <Label htmlFor={`file-${title}`} className="text-sm font-medium cursor-pointer">
                Click to upload or drag and drop
              </Label>
              <p className="text-xs text-muted-foreground">CSV or TXT files (max 50MB)</p>
            </div>
            <Input
              id={`file-${title}`}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">{fileState.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(fileState.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {fileState.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                {fileState.isUploaded && (
                  <Badge variant="secondary" size="sm">Uploaded</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={onClear}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {fileState.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fileState.error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Settings Card Component
interface SettingsCardProps {
  settings: {
    decimalSeparator: '.' | ','
    columnSeparator: ',' | ';' | '\t'
    hasHeaders: boolean
  }
  onUpdateSettings: (settings: Partial<SettingsCardProps['settings']>) => void
}

function SettingsCard({ settings, onUpdateSettings }: SettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Parse Settings
        </CardTitle>
        <CardDescription>
          Configure how files should be parsed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="decimal-separator">Decimal Separator</Label>
          <Select
            value={settings.decimalSeparator}
            onValueChange={(value: '.' | ',') => 
              onUpdateSettings({ decimalSeparator: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=".">Dot (.)</SelectItem>
              <SelectItem value=",">Comma (,)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="column-separator">Column Separator</Label>
          <Select
            value={settings.columnSeparator}
            onValueChange={(value: ',' | ';' | '\t') => 
              onUpdateSettings({ columnSeparator: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=",">Comma (,)</SelectItem>
              <SelectItem value=";">Semicolon (;)</SelectItem>
              <SelectItem value={'\t'}>Tab</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="has-headers"
            checked={settings.hasHeaders}
            onCheckedChange={(checked) => 
              onUpdateSettings({ hasHeaders: checked })
            }
          />
          <Label htmlFor="has-headers">Files have headers</Label>
        </div>
      </CardContent>
    </Card>
  )
}

// Data Preview Component
function DataPreview({ data }: { data: string[][] }) {
  return (
    <div className="rounded border">
      <div className="overflow-auto max-h-64">
        <table className="w-full text-sm">
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={i === 0 ? "bg-muted/50" : ""}>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1 border-r border-b text-xs">
                    {cell || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 bg-muted/25 text-xs text-muted-foreground">
        Showing first {data.length} rows of data
      </div>
    </div>
  )
}
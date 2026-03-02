"use client"

import { useEffect } from "react"
import { HelpCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import type { FileData, UploadConfig } from "@/components/data-upload-module"
import { FilePreview } from "@/components/file-preview"

interface FileConfigurationStepProps {
  spectraFile: FileData | null
  frequencyFile: FileData | null
  setFrequencyFile: (file: FileData | null) => void
  config: UploadConfig
  setConfig: (config: UploadConfig) => void
}

export function FileConfigurationStep({
  spectraFile,
  frequencyFile,
  setFrequencyFile,
  config,
  setConfig,
}: FileConfigurationStepProps) {
  // Reset frequency file if sampling type changes to regular
  useEffect(() => {
    if (config.samplingType === "regular" && frequencyFile) {
      setFrequencyFile(null)
    }
  }, [config.samplingType, frequencyFile, setFrequencyFile])

  if (!spectraFile) {
    return (
      <Alert>
        <AlertTitle>No Spectra File</AlertTitle>
        <AlertDescription>Please upload a spectra file in the previous step.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configure Data Format</h2>
        <p className="text-muted-foreground">
          Specify how your data is formatted to ensure proper parsing and validation.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Decimal Separator</CardTitle>
            <CardDescription>Specify the decimal separator used in your data files.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={config.decimalSeparator}
              onValueChange={(value) => setConfig({ ...config, decimalSeparator: value as "." | "," })}
              className="space-y-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="." id="decimal-dot" />
                <Label htmlFor="decimal-dot" className="flex items-center gap-2">
                  Dot (.)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <HelpCircle className="h-4 w-4" />
                          <span className="sr-only">Help</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Select this if your data uses dots as decimal separators (e.g., 123.45) and commas as column
                          separators.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="," id="decimal-comma" />
                <Label htmlFor="decimal-comma" className="flex items-center gap-2">
                  Comma (,)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <HelpCircle className="h-4 w-4" />
                          <span className="sr-only">Help</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Select this if your data uses commas as decimal separators (e.g., 123,45) and semicolons as
                          column separators.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sampling Type</CardTitle>
            <CardDescription>Specify if your spectra are sampled at regular or irregular intervals.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={config.samplingType}
              onValueChange={(value) => setConfig({ ...config, samplingType: value as "regular" | "irregular" })}
              className="space-y-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regular" id="sampling-regular" />
                <Label htmlFor="sampling-regular" className="flex items-center gap-2">
                  Regular Sampling
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <HelpCircle className="h-4 w-4" />
                          <span className="sr-only">Help</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Select this if all spectra are observed at the same, regular grid of wavelengths/frequencies.
                          This is the most common case.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="irregular" id="sampling-irregular" />
                <Label htmlFor="sampling-irregular" className="flex items-center gap-2">
                  Irregular Sampling
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <HelpCircle className="h-4 w-4" />
                          <span className="sr-only">Help</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Select this if spectra are observed at different frequencies. You will need to provide a
                          separate frequency matrix with the same shape as your spectra matrix.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
              </div>
            </RadioGroup>

            {config.samplingType === "irregular" && !frequencyFile && (
              <Alert className="mt-4">
                <AlertTitle>Frequency Matrix Required</AlertTitle>
                <AlertDescription>
                  For irregular sampling, you need to upload a frequency matrix in the next step.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Data Preview</h3>
        <FilePreview file={spectraFile} />
      </div>
    </div>
  )
}

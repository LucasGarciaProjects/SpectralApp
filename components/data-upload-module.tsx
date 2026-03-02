"use client"

import { useState } from "react"
import { CheckCircle2, ChevronRight, ChevronLeft, HelpCircle, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { SamplingTypeSelection } from "@/components/sampling-type-selection"
import { SpectralMatrixUpload } from "@/components/spectral-matrix-upload"
import { ScalarVariablesUpload } from "@/components/scalar-variables-upload"
import { FinalValidationSummary } from "@/components/final-validation-summary"

export type FileData = {
  name: string
  content: string
  preview: string[][]
  hasHeaders: boolean
  headers: string[]
  isValid: boolean | null
  errors: string[]
  warnings: string[]
  rowCount: number
  columnCount: number
}

export type DomainParameters = {
  startWavelength: number
  endWavelength: number
  numberOfPoints: number
  stepSize: number
}

export type UploadConfig = {
  samplingType: "regular" | "irregular"
  decimalSeparator: "." | ","
  domainParameters?: DomainParameters
  targetVariable: string | null
  predictorVariables: string[]
  categoricalColumns: string[]
}

export type ValidationStatus = {
  spectralMatrix: boolean | null
  frequencyMatrix: boolean | null
  scalarVariables: boolean | null
  domainParameters: boolean | null
  overall: boolean | null
}

export type UploadState = {
  spectralMatrix: FileData | null
  frequencyMatrix: FileData | null
  scalarVariables: FileData | null
  config: UploadConfig
  validationStatus: ValidationStatus
}

interface DataUploadModuleProps {
  onProceedToAnalysis?: (data: UploadState) => void
}

export function DataUploadModule({ onProceedToAnalysis }: DataUploadModuleProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4

  const [uploadState, setUploadState] = useState<UploadState>({
    spectralMatrix: null,
    frequencyMatrix: null,
    scalarVariables: null,
    config: {
      samplingType: "regular",
      decimalSeparator: ".",
      targetVariable: null,
      predictorVariables: [],
      categoricalColumns: [],
    },
    validationStatus: {
      spectralMatrix: null,
      frequencyMatrix: null,
      scalarVariables: null,
      domainParameters: null,
      overall: null,
    },
  })

  // Handle moving to next step
  const handleNextStep = () => {
    if (currentStep < totalSteps && canProceedToNextStep()) {
      setCurrentStep(currentStep + 1)
    }
  }

  // Handle moving to previous step
  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Reset all data
  const handleReset = () => {
    setUploadState({
      spectralMatrix: null,
      frequencyMatrix: null,
      scalarVariables: null,
      config: {
        samplingType: "regular",
        decimalSeparator: ".",
        targetVariable: null,
        predictorVariables: [],
        categoricalColumns: [],
      },
      validationStatus: {
        spectralMatrix: null,
        frequencyMatrix: null,
        scalarVariables: null,
        domainParameters: null,
        overall: null,
      },
    })
    setCurrentStep(1)
  }

  // Handle proceed to analysis
  const handleProceedToAnalysis = () => {
    if (uploadState.validationStatus.overall && onProceedToAnalysis) {
      onProceedToAnalysis(uploadState)
    }
  }

  // Update upload state
  const updateUploadState = (updates: Partial<UploadState>) => {
    setUploadState((prev) => ({
      ...prev,
      ...updates,
      config: { ...prev.config, ...updates.config },
      validationStatus: { ...prev.validationStatus, ...updates.validationStatus },
    }))
  }

  // Determine if we can proceed to the next step
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1: // Sampling Type Selection
        return uploadState.config.samplingType !== null
      case 2: // Spectral Matrix Upload
        if (uploadState.config.samplingType === "regular") {
          return uploadState.spectralMatrix?.isValid === true && uploadState.validationStatus.domainParameters === true
        } else {
          return uploadState.spectralMatrix?.isValid === true && uploadState.frequencyMatrix?.isValid === true
        }
      case 3: // Scalar Variables (optional)
        return true // Always can proceed from this step
      case 4: // Final Validation
        return false // Can't proceed past final validation
      default:
        return false
    }
  }

  // Determine step status
  const getStepStatus = (step: number) => {
    if (currentStep > step) return "completed"
    if (currentStep === step) return "in-progress"
    return "not-started"
  }

  const steps = [
    { id: 1, title: "Sampling Type", description: "Choose data structure" },
    { id: 2, title: "Spectral Data", description: "Upload matrix files" },
    { id: 3, title: "Scalar Variables", description: "Optional response data" },
    { id: 4, title: "Validation", description: "Review and confirm" },
  ]

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium">Spectral Data Upload Workflow</span>
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
                  Follow this guided workflow to upload and configure your spectral data for analysis. Each step
                  validates your data according to FDA requirements.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Horizontal Progress Stepper */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    getStepStatus(step.id) === "completed"
                      ? "border-green-500 bg-green-500 text-white"
                      : getStepStatus(step.id) === "in-progress"
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 bg-white text-gray-500"
                  }`}
                >
                  {getStepStatus(step.id) === "completed" ? <CheckCircle2 className="h-5 w-5" /> : step.id}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-sm font-medium ${
                      getStepStatus(step.id) === "in-progress" ? "text-blue-600" : "text-gray-600"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-full mx-4 transition-colors ${
                    getStepStatus(step.id) === "completed" ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Progress value={(currentStep / totalSteps) * 100} className="h-2" />
      </div>

      {/* Step Content */}
      <Card className="p-6 min-h-[600px]">
        {currentStep === 1 && (
          <SamplingTypeSelection
            selectedType={uploadState.config.samplingType}
            decimalSeparator={uploadState.config.decimalSeparator}
            onTypeSelect={(type) =>
              updateUploadState({
                config: { ...uploadState.config, samplingType: type },
              })
            }
            onDecimalSeparatorSelect={(separator) =>
              updateUploadState({
                config: { ...uploadState.config, decimalSeparator: separator },
              })
            }
          />
        )}

        {currentStep === 2 && <SpectralMatrixUpload uploadState={uploadState} onStateUpdate={updateUploadState} />}

        {currentStep === 3 && <ScalarVariablesUpload uploadState={uploadState} onStateUpdate={updateUploadState} />}

        {currentStep === 4 && <FinalValidationSummary uploadState={uploadState} onStateUpdate={updateUploadState} />}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePreviousStep}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset All
            </Button>
            {currentStep < totalSteps && (
              <Button onClick={handleNextStep} disabled={!canProceedToNextStep()}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {currentStep === totalSteps && uploadState.validationStatus.overall && (
              <Button onClick={handleProceedToAnalysis} className="bg-green-600 hover:bg-green-700">
                Proceed to Analysis
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Available Analysis Modules Preview */}
      {currentStep === totalSteps && uploadState.validationStatus.overall && (
        <div className="mt-4 space-y-4">
          <h3 className="text-lg font-medium">Available Analysis Modules</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Unsupervised Analysis</AlertTitle>
              <AlertDescription>
                Exploratory analysis, functionalization, FPCA, and clustering are available with your spectral data.
              </AlertDescription>
            </Alert>
            <Alert variant={uploadState.scalarVariables ? "default" : "destructive"}>
              <Info className="h-4 w-4" />
              <AlertTitle>Supervised Analysis</AlertTitle>
              <AlertDescription>
                {uploadState.scalarVariables && uploadState.config.targetVariable
                  ? "FPCR, FPCLoR, and regression modules are available with your scalar variables."
                  : "Upload scalar variables with a target variable to enable supervised analysis."}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}
    </div>
  )
}

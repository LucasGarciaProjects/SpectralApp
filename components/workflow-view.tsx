/**
 * Componente de Vista de Flujo de Trabajo Principal
 * 
 * Este componente gestiona el flujo de trabajo completo de la aplicación de
 * análisis espectral, incluyendo carga de datos, validación de dominio,
 * funcionalización y pasos de análisis. Proporciona una interfaz paso a paso
 * con seguimiento de progreso y navegación.
 */

"use client"

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { CheckCircle, Circle, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { useAppState } from '@/hooks/useAppState'
import { UploadView } from '@/components/upload-view'
import { DomainValidationView } from '@/components/domain-validation-view'
import { FunctionalizationView } from '@/components/functionalization-view'
import AnalysisDashboard from '@/components/analysis-dashboard'


type WorkflowStep = 'upload' | 'domain' | 'functionalization' | 'analysis'

interface Step {
  id: WorkflowStep
  title: string
  description: string
  isCompleted: boolean
  isEnabled: boolean
}

export function WorkflowView() {
  const { rawData, domain, functionalBases, selectedBaseIndex } = useAppState()
  const pathname = usePathname()
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload')
  const [lastDataHash, setLastDataHash] = useState<string | null>(null)

  // Determine current step based on URL path for navigation
  useEffect(() => {
    if (pathname === '/domain') {
      setCurrentStep('domain')
    } else if (pathname === '/functionalization') {
      setCurrentStep('functionalization')
    } else if (pathname === '/analysis') {
      setCurrentStep('analysis')
    } else {
      setCurrentStep('upload')
    }
  }, [pathname])

  // Determine step states
  const steps: Step[] = [
    {
      id: 'upload',
      title: 'Upload Data',
      description: 'Upload spectral and scalar data',
      isCompleted: rawData !== null,
      isEnabled: true
    },
    {
      id: 'domain',
      title: 'Configure Domain',
      description: 'Set wavelength range and sampling',
      isCompleted: domain?.isConfirmed === true,
      isEnabled: rawData !== null
    },
    {
      id: 'functionalization',
      title: 'Functionalize',
      description: 'Create functional datasets',
      isCompleted: functionalBases.length > 0,
      isEnabled: domain?.isConfirmed === true
    },
    {
      id: 'analysis',
      title: 'Analysis',
      description: 'Perform functional data analysis',
      isCompleted: false, // Analysis is always ongoing
      isEnabled: functionalBases.length > 0 && selectedBaseIndex !== null
    }
  ]

  // Detect when new data is uploaded (not just navigation)
  useEffect(() => {
    if (rawData) {
      // Create a simple hash of the data to detect changes
      const dataHash = JSON.stringify(rawData.slice(0, 3)) // Use first 3 rows as hash
      
      if (lastDataHash === null) {
        // First time data is loaded
        setLastDataHash(dataHash)
      } else if (lastDataHash !== dataHash) {
        // Data has changed - this is a new upload
        setLastDataHash(dataHash)
        
        // Auto-advance only if we're on upload step and data is new
        if (currentStep === 'upload') {
          const currentStepData = steps.find(step => step.id === currentStep)
          if (currentStepData?.isCompleted) {
            const currentIndex = steps.findIndex(step => step.id === currentStep)
            const nextStep = steps[currentIndex + 1]
            if (nextStep && nextStep.isEnabled && !nextStep.isCompleted) {
              setTimeout(() => setCurrentStep(nextStep.id), 1000)
            }
          }
        }
      }
    }
  }, [rawData, currentStep, lastDataHash])

  const handleStepClick = (stepId: WorkflowStep) => {
    const step = steps.find(s => s.id === stepId)
    if (step?.isEnabled) {
      setCurrentStep(stepId)
    }
  }

  const handleContinue = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep)
    const nextStep = steps[currentIndex + 1]
    if (nextStep && nextStep.isEnabled) {
      setCurrentStep(nextStep.id)
    }
  }

  const handleBack = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep)
    const prevStep = steps[currentIndex - 1]
    if (prevStep) {
      setCurrentStep(prevStep.id)
      // No need to prevent auto-advance - the new logic only triggers on data changes
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analysis Workflow</h1>
          <p className="text-muted-foreground">
            Complete each step to proceed with your analysis
          </p>
        </div>
      </div>

      {/* Workflow Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Progress</CardTitle>
          <CardDescription>
            Follow the steps below to complete your analysis setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => handleStepClick(step.id)}
                  disabled={!step.isEnabled}
                  className={`flex flex-col items-center space-y-2 p-4 rounded-lg transition-colors ${
                    currentStep === step.id 
                      ? 'bg-blue-50 border-2 border-blue-200' 
                      : step.isEnabled 
                        ? 'hover:bg-gray-50 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2">
                    {step.isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className={`w-5 h-5 ${currentStep === step.id ? 'text-blue-600' : 'text-gray-400'}`} />
                    )}
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-sm font-medium ${currentStep === step.id ? 'text-blue-900' : 'text-gray-900'}`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {step.description}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {step.isCompleted && (
                      <Badge variant="secondary" size="sm">Complete</Badge>
                    )}
                    {currentStep === step.id && (
                      <Badge variant="default" size="sm">Current</Badge>
                    )}
                    {!step.isEnabled && (
                      <Badge variant="outline" size="sm">Locked</Badge>
                    )}
                  </div>
                </button>

                {index < steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gray-400 mx-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <div>
        {currentStep === 'upload' && (
          <UploadView />
        )}

        {currentStep === 'domain' && (
          <DomainValidationView 
            onBack={handleBack}
            onContinue={handleContinue}
          />
        )}

        {currentStep === 'functionalization' && (
          <FunctionalizationView 
            onBack={handleBack}
            onContinue={handleContinue}
          />
        )}

        {currentStep === 'analysis' && (
          <AnalysisDashboard 
            functionalBases={functionalBases}
            onBack={handleBack}
          />
        )}

      </div>
    </div>
  )
}
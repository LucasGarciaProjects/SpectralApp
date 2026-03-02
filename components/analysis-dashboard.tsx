/**
 * Componente de Dashboard de Análisis
 * 
 * Este componente sirve como interfaz principal para todas las técnicas de
 * análisis de datos funcionales. Proporciona una interfaz con pestañas para
 * acceder a diferentes módulos de análisis incluyendo:
 * - Estadísticas descriptivas (media, desv. estándar, covarianza, correlación)
 * - Aprendizaje no supervisado (FPCA, FICA)
 * - Aprendizaje supervisado (FPCR, FPCLoR, SoFR, FoSR, FoFR, FLDA)
 * - Selección y gestión de datasets
 */

"use client";

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import MeanStdFunction from '@/components/analysis/mean-std-function'
import CovarianceFunction from '@/components/analysis/covariance-function'
import CorrelationFunction from '@/components/analysis/correlation-function' 
import FPCAView from './analysis/fpca-view'
import FICAView from './analysis/fica-view'
import FPCRView from "@/components/analysis/fpcr-view"
import FPCLoRView from "@/components/analysis/fpclor-view"
import SOFRView from "@/components/analysis/sofr-view"
import FOSRView from "@/components/analysis/fosr-view"
import FOFRView from "@/components/analysis/fofr-view"
import FLDAView from "@/components/analysis/flda-view"
import FunctionalAnovaView from "@/components/analysis/functional-anova-view"
import { FunctionalDataset } from '@/hooks/useAppState'

interface AnalysisDashboardProps {
  functionalBases: FunctionalDataset[]
  onBackToFunctionalize?: () => void
  onBack?: () => void
}

export default function AnalysisDashboard({ functionalBases, onBackToFunctionalize, onBack }: AnalysisDashboardProps) {
  const [selectedDatasetIndex, setSelectedDatasetIndex] = React.useState<number | null>(null);
  const selectedDataset =
    selectedDatasetIndex !== null && functionalBases[selectedDatasetIndex]
      ? functionalBases[selectedDatasetIndex]
      : null;

  // Si no hay datasets disponibles
  if (functionalBases.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
        <h2 className="text-2xl font-bold">Analysis Dashboard</h2>
        <p className="text-muted-foreground">
          No functional datasets available. Please return to Functionalization and save at least one dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBack || onBackToFunctionalize}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Functionalize
        </Button>
        <h2 className="text-2xl font-bold">Analysis Dashboard</h2>
        <div className="w-32"></div> {/* Spacer for centering */}
      </div>

      {/* Selector de dataset funcional */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="text-lg">Select Functional Dataset</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedDatasetIndex !== null ? selectedDatasetIndex.toString() : ""}
            onValueChange={(val) => setSelectedDatasetIndex(parseInt(val))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose a dataset..." />
            </SelectTrigger>
            <SelectContent>
              {functionalBases.length === 0 ? (
                <SelectItem value="none" disabled>
                  No datasets available
                </SelectItem>
              ) : (
                functionalBases.map((ds, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {ds.label || `Dataset ${i + 1}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabs principales */}
      <Tabs defaultValue="exploratory" className="w-full mt-6">
        <TabsList>
          <TabsTrigger value="exploratory">Exploratory Analysis</TabsTrigger>
          <TabsTrigger value="unsupervised">Unsupervised Analysis</TabsTrigger>
          <TabsTrigger value="supervised">Supervised Analysis</TabsTrigger>
        </TabsList>

        {/* Exploratory Analysis */}
        <TabsContent value="exploratory">
          <Tabs defaultValue="descriptive" className="w-full mt-4">
            <TabsList>
              <TabsTrigger value="descriptive">Descriptive Statistics</TabsTrigger>
              <TabsTrigger value="anova">Functional ANOVA</TabsTrigger>
            </TabsList>

            <TabsContent value="descriptive">
              {selectedDataset ? (
                <div className="space-y-6 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Mean & Std Functions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-96">
                        <MeanStdFunction functionalDataset={selectedDataset} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Bivariate Covariance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-96">
                        <CovarianceFunction functionalDataset={selectedDataset} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Bivariate Correlation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-96">
                        <CorrelationFunction functionalDataset={selectedDataset} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-center text-muted-foreground mt-6">
                  No dataset selected
                </p>
              )}
            </TabsContent>

            <TabsContent value="anova">
              {selectedDataset ? (
                <FunctionalAnovaView functionalDataset={selectedDataset} />
              ) : (
                <p className="text-center text-muted-foreground mt-6">No dataset selected</p>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Unsupervised Analysis */}
        <TabsContent value="unsupervised">
          {selectedDataset ? (
            <Tabs defaultValue="fpca" className="w-full mt-4">
              <TabsList>
                <TabsTrigger value="fpca">Functional PCA</TabsTrigger>
                <TabsTrigger value="fica">Functional ICA</TabsTrigger>
              </TabsList>

              <TabsContent value="fpca">
                <Card>
                  <CardHeader>
                    <CardTitle>Functional PCA</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FPCAView functionalDataset={selectedDataset} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fica">
                <Card>
                  <CardHeader>
                    <CardTitle>Functional ICA</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FICAView functionalDataset={selectedDataset} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-center text-muted-foreground mt-6">No dataset selected</p>
          )}
        </TabsContent>

        {/* Supervised Analysis */}
        <TabsContent value="supervised">
          <div className="mt-4">
            <Tabs defaultValue="fpcr">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="fpcr">FPCR</TabsTrigger>
                <TabsTrigger value="fpclor">FPCLoR</TabsTrigger>
                <TabsTrigger value="sofr">SoFR</TabsTrigger>
                <TabsTrigger value="fosr">FoSR</TabsTrigger>
                <TabsTrigger value="fofr">FoFR</TabsTrigger>
                <TabsTrigger value="flda">FLDA</TabsTrigger>
              </TabsList>

              <TabsContent value="fpcr">
                <FPCRView functionalDataset={selectedDataset || undefined} />
              </TabsContent>

              <TabsContent value="fpclor">
                <FPCLoRView functionalDataset={selectedDataset || undefined} />
              </TabsContent>

              <TabsContent value="sofr">
                <SOFRView functionalDataset={selectedDataset || undefined} />
              </TabsContent>

              <TabsContent value="fosr">
                <FOSRView functionalDataset={selectedDataset || undefined} />
              </TabsContent>

              <TabsContent value="fofr">
                <FOFRView functionalDataset={selectedDataset || undefined} />
              </TabsContent>

              <TabsContent value="flda">
                <FLDAView functionalDataset={selectedDataset || undefined} />
              </TabsContent>

            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

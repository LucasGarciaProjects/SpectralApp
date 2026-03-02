/**
 * Analysis Page Component
 * 
 * This page renders the analysis dashboard for functional data analysis.
 * It provides access to all analysis techniques including FPCA, regression,
 * and classification methods.
 */

"use client"

import { useAppState } from '@/hooks/useAppState'
import AnalysisDashboard from '@/components/analysis-dashboard'
import { useRouter } from 'next/navigation'

export default function AnalysisPage() {
  const { functionalBases } = useAppState()
  const router = useRouter()

  const handleBackToFunctionalize = () => {
    router.push('/functionalization')
  }

  return (
    <div className="p-6">
      <AnalysisDashboard 
        functionalBases={functionalBases} 
        onBackToFunctionalize={handleBackToFunctionalize}
      />
    </div>
  )
}
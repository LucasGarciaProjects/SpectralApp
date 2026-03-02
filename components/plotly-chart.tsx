"use client"

import { useState, useEffect } from 'react'

// Plotly types
export interface PlotData {
  x?: any[]
  y?: any[]
  type?: string
  mode?: string
  name?: string
  line?: any
  marker?: any
  text?: any[]
  hovertemplate?: string
  showlegend?: boolean
}

export interface PlotLayout {
  title?: string
  xaxis?: any
  yaxis?: any
  legend?: any
  margin?: any
  paper_bgcolor?: string
  plot_bgcolor?: string
  autosize?: boolean
  barmode?: string
}

export interface PlotConfig {
  displayModeBar?: boolean
  displaylogo?: boolean
  modeBarButtonsToRemove?: string[]
  responsive?: boolean
}

interface PlotlyChartProps {
  data: PlotData[]
  layout: PlotLayout
  config?: PlotConfig
  style?: React.CSSProperties
  className?: string
  xAxisTitle?: string
  yAxisTitle?: string
}

export function buildPlotlyTraces(curves: number[][], x: number[], opts?: { highlightIndex?: number; highlightSingle?: boolean }) {
  const n = curves?.length ?? 0
  const hi = opts?.highlightIndex ?? 0
  const highlightSingle = opts?.highlightSingle ?? true
  
  if (!highlightSingle) {
    // todas igual
    return Array.from({ length: n }, (_, i) => ({
      x, 
      y: curves[i], 
      type: "scatter", 
      mode: "lines",
      line: { width: 1.5 },
      name: `Curve ${i+1}`,
    }))
  }
  
  // modo destacar una
  return Array.from({ length: n }, (_, i) => ({
    x, 
    y: curves[i], 
    type: "scatter", 
    mode: "lines",
    opacity: i === hi ? 1 : 0.35,
    line: { width: i === hi ? 2 : 1 },
    name: `Curve ${i+1}`,
  }))
}

export function PlotlyChart({ data, layout, config, style, className, xAxisTitle, yAxisTitle }: PlotlyChartProps) {
  const [Plot, setPlot] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadPlotly = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Import Plotly with better error handling
        const plotlyModule = await import('react-plotly.js')
        
        if (mounted) {
          // Use default export or the main export
          setPlot(() => plotlyModule.default || plotlyModule)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load Plotly:', err)
        if (mounted) {
          setError('Failed to load chart library')
          setIsLoading(false)
        }
      }
    }

    loadPlotly()

    return () => {
      mounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-50 rounded ${className || ''}`}
        style={style || { width: '100%', height: '400px' }}
      >
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading chart...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-red-50 border border-red-200 rounded ${className || ''}`}
        style={style || { width: '100%', height: '400px' }}
      >
        <div className="text-center text-red-600">
          <p className="font-medium">Chart Loading Error</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!Plot) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-50 rounded ${className || ''}`}
        style={style || { width: '100%', height: '400px' }}
      >
        <p className="text-gray-600">Chart not available</p>
      </div>
    )
  }

  // Default config
  const defaultConfig: PlotConfig = {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
    responsive: true,
    ...config
  }

  // Default layout
  const defaultLayout: PlotLayout = {
    margin: { l: 60, r: 40, t: 40, b: 80 },
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    autosize: true,
    ...layout
  }

  return (
    <div className={className} style={style}>
      <Plot
        data={data}
        layout={{
          ...defaultLayout,
          xaxis: { ...defaultLayout.xaxis, title: xAxisTitle || defaultLayout.xaxis?.title || "X Axis" },
          yaxis: { ...defaultLayout.yaxis, title: yAxisTitle || defaultLayout.yaxis?.title || "Y Axis" },
          margin: { l: 50, r: 20, t: 20, b: 50, ...defaultLayout.margin }
        }}
        config={defaultConfig}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
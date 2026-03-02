import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

async function findPythonBin(candidates: string[]): Promise<string> {
  for (const cmd of candidates) {
    try {
      await new Promise((resolve, reject) => {
        const p = spawn(cmd, ['-V'])
        p.on('close', (code) => code === 0 ? resolve(null) : reject(null))
        p.on('error', () => reject(null))
      })
      return cmd
    } catch {
      // Continue to next candidate
    }
  }
  throw new Error('No Python interpreter found')
}

export async function POST(request: NextRequest) {
  try {
    const { rawData, domain, params } = await request.json()
    
    // Prepare Python input
    const pythonInput = {
      action: "functionalize",
      rawData,
      domain,
      params
    }
    
    // Find Python interpreter robustly
    const configured = process.env.PYTHON_BIN
    const candidates = [
      configured,
      path.join(process.cwd(), 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
      'python3',
      'python'
    ].filter(Boolean) as string[]
    
    const pythonPath = await findPythonBin(candidates)
    
    const pythonProcess = spawn(pythonPath, [
      path.join(process.cwd(), 'python', 'functionalize_worker.py')
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    // Send input to Python
    pythonProcess.stdin.write(JSON.stringify(pythonInput))
    pythonProcess.stdin.end()
    
    // Collect output
    let output = ''
    let error = ''
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString()
    })
    
    // Wait for completion
    const exitCode = await new Promise((resolve) => {
      pythonProcess.on('close', resolve)
    })
    
    if (exitCode !== 0) {
      console.error('Python process error:', error)
      return NextResponse.json(
        { error: 'Functionalization failed', details: error },
        { status: 500 }
      )
    }
    
    const result = JSON.parse(output)
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

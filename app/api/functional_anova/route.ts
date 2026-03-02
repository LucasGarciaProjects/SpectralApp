import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

/**
 * Ruta API de ANOVA Funcional
 * 
 * Llama al backend Python (functional_anova.py) para realizar Análisis de Varianza Funcional
 * usando scikit-fda. Acepta matriz de datos funcionales, puntos de grid y etiquetas de grupos,
 * retorna estadístico F, p-valor y curvas medias por grupo.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { curves, grid, groups } = body;

    // Validar entrada
    if (!Array.isArray(curves) || curves.length === 0 || !Array.isArray(curves[0])) {
      return NextResponse.json(
        { ok: false, error: "Invalid curves matrix" },
        { status: 400 }
      );
    }
    if (!Array.isArray(groups) || groups.length !== curves.length) {
      return NextResponse.json(
        { ok: false, error: "Invalid groups length" },
        { status: 400 }
      );
    }
    if (grid && (!Array.isArray(grid) || grid.length !== curves[0].length)) {
      return NextResponse.json(
        { ok: false, error: "Invalid grid length" },
        { status: 400 }
      );
    }

    // Preparar ruta del script Python
    const pyPath = path.join(process.cwd(), "python", "functional_anova.py");
    
    // Lanzar proceso Python
    const py = spawn("python", [pyPath], { stdio: ["pipe", "pipe", "pipe"] });

    const payload = JSON.stringify({ curves, grid, groups });

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (d) => (stdout += d.toString()));
    py.stderr.on("data", (d) => (stderr += d.toString()));

    // Esperar a que termine el proceso
    const exitCode = await new Promise<number>((resolve) => {
      py.on("close", (code) => resolve(code ?? 0));
      py.stdin.write(payload);
      py.stdin.end();
    });

    if (exitCode !== 0) {
      console.error("[ANOVA API] Error Python:", stderr);
      return NextResponse.json(
        { ok: false, error: "Python error", stderr },
        { status: 500 }
      );
    }

    // Parsear respuesta
    try {
      const parsed = JSON.parse(stdout);
      return NextResponse.json(parsed);
    } catch (e) {
      console.error("[ANOVA API] JSON inválido desde Python:", stdout, stderr);
      return NextResponse.json(
        { ok: false, error: "Invalid JSON from Python", stderr, raw: stdout },
        { status: 500 }
      );
    }
  } catch (e: any) {
    console.error("[ANOVA API] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


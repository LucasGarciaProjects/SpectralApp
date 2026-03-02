"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ResponseUploadProps {
  purpose: "regression" | "classification";
  onLoaded: (data: number[]) => void;
}

export default function ResponseUpload({ purpose, onLoaded }: ResponseUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [hasHeaders, setHasHeaders] = useState(true);
  const [columnName, setColumnName] = useState("response");
  const [preview, setPreview] = useState<string[][]>([]);
  const [summary, setSummary] = useState<{
    rows: number;
    min?: number;
    max?: number;
    classes?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/).map((l) => l.split(/[;,]/));
      
      // Determine data start row
      const dataStartRow = hasHeaders ? 1 : 0;
      setPreview(lines.slice(0, 10));

      const values = lines.slice(dataStartRow).map((row) => parseFloat(row[0]));
      
      // Validation
      if (purpose === "classification") {
        if (!values.every((v) => v === 0 || v === 1)) {
          throw new Error("Classification requires a binary response (0/1).");
        }
      }
      if (purpose === "regression") {
        if (!values.every((v) => !isNaN(v))) {
          throw new Error("Regression requires a numeric response.");
        }
      }
      
      // Calculate summary
      const validValues = values.filter(v => !isNaN(v));
      const summaryData: typeof summary = {
        rows: validValues.length
      };
      
      if (purpose === "regression") {
        summaryData.min = Math.min(...validValues);
        summaryData.max = Math.max(...validValues);
      } else {
        const uniqueClasses = new Set(validValues);
        summaryData.classes = uniqueClasses.size;
      }
      
      setSummary(summaryData);
      onLoaded(values);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input type="file" accept=".csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="hasHeaders" 
            checked={hasHeaders} 
            onCheckedChange={(checked) => setHasHeaders(checked as boolean)}
          />
          <Label htmlFor="hasHeaders">Has headers?</Label>
        </div>
        {!hasHeaders && (
          <div className="space-y-1">
            <Label htmlFor="columnName">Column name:</Label>
            <Input
              id="columnName"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              placeholder="response"
              className="w-32"
            />
          </div>
        )}
        <Button onClick={handleLoad} disabled={!file}>Load Response Variable</Button>
      </div>
      
      {error && <p className="text-red-600 text-sm">{error}</p>}
      
      {preview.length > 0 && (
        <div className="space-y-2">
          <div className="border rounded p-2 text-sm">
            <strong>Preview (first 10 rows):</strong>
            <div className="mt-2 max-h-48 overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {preview[0]?.map((_, i) => (
                      <th key={i} className="px-2 py-1 text-left border-b">
                        Column {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 border-b">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {summary && (
            <div className="border rounded p-2 text-sm bg-gray-50">
              <strong>Summary:</strong>
              <div className="mt-1 space-y-1">
                <div>Rows: {summary.rows}</div>
                {purpose === "regression" && summary.min !== undefined && summary.max !== undefined && (
                  <div>Range: [{summary.min.toFixed(2)}, {summary.max.toFixed(2)}]</div>
                )}
                {purpose === "classification" && summary.classes !== undefined && (
                  <div>Classes: {summary.classes}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

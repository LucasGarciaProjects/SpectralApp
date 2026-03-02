"use client";
import { useState } from "react";
import { useAppState } from "@/hooks/useAppState";
import { parseScalarMatrix } from "@/lib/data-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function ScalarUploadInline(props: { purpose: "regression" | "classification"; onLoaded?: () => void }) {
  const { setScalarData } = useAppState();
  const [hasHeaders, setHasHeaders] = useState(true);
  const [decimalSeparator, setDecimalSeparator] = useState(".");
  const [columnSeparator, setColumnSeparator] = useState(",");
  const [columnNames, setColumnNames] = useState<string>("");
  const [categoricalCols, setCategoricalCols] = useState<string>(""); // "2,4" etc.
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const text = await file.text();
      const parsed = parseScalarMatrix(text, { hasHeaders, decimalSeparator, columnSeparator });
      const catIdx = categoricalCols ? categoricalCols.split(",").map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n)) : [];
      setScalarData(parsed, {
        hasHeaders,
        decimalSeparator,
        columnSeparator,
        categoricalColumns: catIdx,
        columnNames: hasHeaders ? Object.keys(parsed[0] || {}) : columnNames.split(",").map(s=>s.trim()).filter(Boolean)
      });
      props.onLoaded?.();
    } catch (e:any) {
      setError(e?.message ?? "Failed to parse scalar dataset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border space-y-3">
      <h4 className="font-semibold">Upload required scalar dataset</h4>
      <p className="text-sm text-muted-foreground">
        This tool requires a scalar dataset ({props.purpose === "classification" ? "binary response (0/1) or categorical target" : "continuous response"}).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>File</Label>
          <Input type="file" accept=".csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label>Has headers?</Label>
          <div className="flex items-center gap-2"><Switch checked={hasHeaders} onCheckedChange={(v)=>setHasHeaders(!!v)} /><span>{hasHeaders ? "Yes" : "No"}</span></div>
        </div>
        <div>
          <Label>Decimal separator</Label>
          <Select value={decimalSeparator} onValueChange={setDecimalSeparator}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value=".">.</SelectItem>
              <SelectItem value=",">,</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Column separator</Label>
          <Select value={columnSeparator} onValueChange={setColumnSeparator}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value=",">Comma (,)</SelectItem>
              <SelectItem value=";">Semicolon (;)</SelectItem>
              <SelectItem value="\t">Tab</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!hasHeaders && (
          <div className="md:col-span-2">
            <Label>Custom column names (comma-separated)</Label>
            <Input placeholder="y,x1,x2,..." value={columnNames} onChange={(e)=>setColumnNames(e.target.value)} />
          </div>
        )}
        <div className="md:col-span-2">
          <Label>Categorical columns (indices, comma-separated)</Label>
          <Input placeholder="e.g., 2,4" value={categoricalCols} onChange={(e)=>setCategoricalCols(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button onClick={onSubmit} disabled={loading || !file}>{loading ? "Loading..." : "Load dataset"}</Button>
    </div>
  );
}

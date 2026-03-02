"use client";

/**
 * Vista de ANOVA Funcional
 * 
 * Interfaz para ejecutar ANOVA Funcional. Permite subir CSV con variables categóricas,
 * seleccionar la variable de agrupación y visualizar el estadístico F y las curvas
 * medias por grupo. Sigue el patrón UX de FPCA/FICA para consistencia.
 */

import React, { useState, useMemo } from "react";
import ClientPlot from "@/components/common/ClientPlot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FunctionalDataset } from "@/hooks/useAppState";

type ExtraVar =
  | { name: string; type: "numeric"; values: number[] }
  | { name: string; type: "categorical"; values: string[]; categories: string[] };

interface Props {
  functionalDataset: FunctionalDataset;
}

export default function FunctionalAnovaView({ functionalDataset }: Props) {
  const nObs = functionalDataset.data.length;
  const pGrid = functionalDataset.data[0]?.length ?? 0;

  const domainX = useMemo(
    () =>
      Array.isArray((functionalDataset as any).domain) &&
      (functionalDataset as any).domain.length === pGrid
        ? (functionalDataset as any).domain
        : Array.from({ length: pGrid }, (_, j) => j + 1),
    [pGrid, (functionalDataset as any).domain]
  );

  const [extraVars, setExtraVars] = useState<ExtraVar[]>([]);
  const [groupVarName, setGroupVarName] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [pValue, setPValue] = useState<number | null>(null);
  const [fCurve, setFCurve] = useState<number[] | null>(null);
  const [groupMeans, setGroupMeans] = useState<Record<string, number[]>>({});
  const [groupLevels, setGroupLevels] = useState<string[]>([]);

  const handleUploadVars = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const delimiter = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return;

      const headers = lines[0].split(delimiter).map((h) => h.trim());
      const cols: string[][] = headers.map(() => []);

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter);
        headers.forEach((_, j) => cols[j].push((parts[j] ?? "").trim()));
      }

      const vars: ExtraVar[] = [];
      for (let j = 0; j < headers.length; j++) {
        const arr = cols[j];
        if (arr.length !== nObs) continue;
        const nums = arr.map((v) => Number(v));
        const isNumeric = nums.every((v, idx) => !isNaN(v) || arr[idx] === "");
        if (isNumeric) {
          vars.push({ name: headers[j], type: "numeric", values: nums.map((v) => (isNaN(v) ? 0 : v)) });
        } else {
          const categories = Array.from(new Set(arr.map((x) => (x === "" ? "NA" : x))));
          vars.push({ name: headers[j], type: "categorical", values: arr.map((x) => (x === "" ? "NA" : x)), categories });
        }
      }

      setExtraVars(vars);
      const firstCat = vars.find((v) => v.type === "categorical");
      setGroupVarName(firstCat?.name ?? "");

      console.log("[ANOVA] Loaded extra vars:", vars.map((v) => ({ name: v.name, type: v.type })));
    } catch (e) {
      console.error("[ANOVA] Error processing CSV:", e);
    }
  };

  const clearVars = () => {
    setExtraVars([]);
    setGroupVarName("");
    setPValue(null);
    setFCurve(null);
    setGroupMeans({});
    setGroupLevels([]);
  };

  const chosenGroups = useMemo(() => {
    const v = extraVars.find((a) => a.name === groupVarName && a.type === "categorical");
    return (v as Extract<ExtraVar, { type: "categorical" }> | undefined)?.values ?? [];
  }, [extraVars, groupVarName]);

  const canRun = chosenGroups.length === nObs && nObs > 1 && pGrid > 1;

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    chosenGroups.forEach((g: string) => {
      const key = String(g);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [chosenGroups]);

  const runANOVA = async () => {
    if (!canRun) return;
    setRunning(true);
    setPValue(null);
    setFCurve(null);
    setGroupMeans({});
    setGroupLevels([]);

    try {
      const resp = await fetch("/api/functional_anova", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curves: functionalDataset.data,
          grid: domainX,
          groups: chosenGroups,
        }),
      });
      
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("[ANOVA] API error:", errorText);
        alert(`Error: ${errorText}`);
        setRunning(false);
        return;
      }
      
      const json = await resp.json();
      
      if (!json?.ok) {
        console.error("[ANOVA] Python error:", json);
        alert(`ANOVA failed: ${json.error || 'Unknown error'}`);
        setRunning(false);
        return;
      }
      
      setPValue(json.p_value ?? null);
      setFCurve(Array.isArray(json.f_statistic) ? json.f_statistic : null);
      setGroupMeans(json.group_means || {});
      setGroupLevels(Array.isArray(json.groups_levels) ? json.groups_levels : Object.keys(json.group_means || {}));

      console.log("[ANOVA] OK", {
        p_value: json.p_value,
        f_statistic_len: Array.isArray(json.f_statistic) ? json.f_statistic.length : null,
        groups: json.groups_levels,
      });
    } catch (e) {
      console.error("[ANOVA] fetch error:", e);
      alert(`Network error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setRunning(false);
    }
  };

  const categoricalVars = extraVars.filter((v) => v.type === "categorical");
  const hasMultipleCategoricals = categoricalVars.length > 1;
  const hasOneCategorical = categoricalVars.length === 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Functional ANOVA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Upload extra variable(s) (CSV)</Label>
              <Input type="file" accept=".csv,.txt" onChange={(e) => handleUploadVars(e.target.files?.[0] ?? null)} />
              {extraVars.length > 0 && <p className="text-xs text-green-600">✅ {extraVars.length} variable(s) loaded.</p>}
              {extraVars.length > 0 && (
                <div className="pt-1">
                  <Button variant="destructive" size="sm" onClick={clearVars}>
                    Clear variables
                  </Button>
                </div>
              )}
            </div>

            {(hasMultipleCategoricals || (hasOneCategorical && groupVarName === "")) && (
              <div className="space-y-2">
                <Label>Select grouping variable</Label>
                <Select value={groupVarName} onValueChange={(v) => setGroupVarName(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a categorical variable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoricalVars.map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {groupVarName !== "" && Object.keys(groupCounts).length > 0 && (
              <div className="text-xs text-muted-foreground">
                Groups: <b>{Object.entries(groupCounts).map(([g, c]) => `${g} (${c})`).join(", ")}</b>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={runANOVA} disabled={!canRun || running}>
                {running ? "Running..." : "Run ANOVA"}
              </Button>
            </div>

            {!canRun && <p className="text-xs text-muted-foreground">Upload a CSV with a categorical column (length = {nObs}) and then click "Run ANOVA".</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {pValue === null && !fCurve && Object.keys(groupMeans).length === 0 ? (
              <p className="text-muted-foreground">Upload variable(s), select a grouping variable if needed, and run ANOVA.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-sm">
                    <div>
                      <b>F-statistic calculated:</b> {fCurve ? "Yes" : "—"}
                    </div>
                    <div className="text-muted-foreground">
                      Functional F-statistic computed at each point. Higher values indicate greater differences between group means.
                    </div>
                  </div>
                </div>

                {fCurve && (
                  <ClientPlot
                    data={[
                      {
                        x: domainX,
                        y: fCurve,
                        type: "scatter",
                        mode: "lines",
                        name: "F-statistic",
                      } as any,
                    ]}
                    layout={{
                      title: "Functional F-statistic across the domain",
                      margin: { t: 40, r: 10, l: 45, b: 40 },
                      xaxis: { title: "Domain" },
                      yaxis: { title: "F" },
                      showlegend: true,
                    }}
                    style={{ width: "100%", height: "340px" }}
                  />
                )}

                {Object.keys(groupMeans).length > 0 && (
                  <ClientPlot
                    data={Object.entries(groupMeans).map(([g, y]) => ({
                      x: domainX,
                      y,
                      type: "scatter",
                      mode: "lines",
                      name: `Mean: ${g}`,
                    })) as any}
                    layout={{
                      title: "Group mean functions",
                      margin: { t: 40, r: 10, l: 45, b: 40 },
                      xaxis: { title: "Domain" },
                      yaxis: { title: "Value" },
                      showlegend: true,
                    }}
                    style={{ width: "100%", height: "360px" }}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

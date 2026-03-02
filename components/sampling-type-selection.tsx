"use client"

import { BarChart3, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SamplingTypeSelectionProps {
  selectedType: "regular" | "irregular"
  decimalSeparator: "." | ","
  onTypeSelect: (type: "regular" | "irregular") => void
  onDecimalSeparatorSelect: (separator: "." | ",") => void
}

export function SamplingTypeSelection({
  selectedType,
  decimalSeparator,
  onTypeSelect,
  onDecimalSeparatorSelect,
}: SamplingTypeSelectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose Your Data Structure</h2>
        <p className="text-muted-foreground">Select the sampling type that matches your spectral data format</p>
      </div>

      {/* Decimal Separator Selection */}
      <div className="flex justify-center">
        <div className="space-y-2">
          <Label htmlFor="decimal-separator">Decimal Separator</Label>
          <Select value={decimalSeparator} onValueChange={onDecimalSeparatorSelect}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=".">Dot (.) - English format</SelectItem>
              <SelectItem value=",">Comma (,) - European format</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sampling Type Selection */}
      <RadioGroup value={selectedType} onValueChange={onTypeSelect} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <RadioGroupItem value="regular" id="regular" className="peer sr-only" />
          <Label
            htmlFor="regular"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
          >
            <Card className="w-full border-0 shadow-none">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Regular Sampling</CardTitle>
                <CardDescription>Spectra observed at regular intervals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>✓ Single spectral matrix file</p>
                  <p>✓ Equally spaced wavelengths/frequencies</p>
                  <p>✓ You'll specify domain parameters</p>
                  <p>✓ Most common format</p>
                </div>
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <strong>Example:</strong> Wavelengths from 400nm to 700nm with 1nm steps
                </div>
              </CardContent>
            </Card>
          </Label>
        </div>

        <div>
          <RadioGroupItem value="irregular" id="irregular" className="peer sr-only" />
          <Label
            htmlFor="irregular"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
          >
            <Card className="w-full border-0 shadow-none">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                  <BarChart3 className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-xl">Irregular Sampling</CardTitle>
                <CardDescription>Spectra observed at varying frequencies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>✓ Two matrix files required</p>
                  <p>✓ Amplitude + frequency matrices</p>
                  <p>✓ Different frequencies per observation</p>
                  <p>✓ Advanced data structure</p>
                </div>
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <strong>Example:</strong> Each spectrum has different wavelength points
                </div>
              </CardContent>
            </Card>
          </Label>
        </div>
      </RadioGroup>

      {selectedType && (
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Selected: <strong>{selectedType === "regular" ? "Regular" : "Irregular"} Sampling</strong> with{" "}
            <strong>{decimalSeparator === "." ? "dot" : "comma"}</strong> as decimal separator
          </p>
        </div>
      )}
    </div>
  )
}

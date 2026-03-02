"use client"

import { HelpCircle, LineChart, List, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function AppHeader({
  setActiveSection,
  onBackToUpload,
}: {
  setActiveSection: (section: string) => void
  onBackToUpload?: () => void
}) {
  const navItems = [
    { id: "overview", label: "Overview", icon: List },
    { id: "exploratory", label: "Analysis", icon: LineChart },
    { id: "results", label: "Results", icon: List },
  ]

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <LineChart className="size-6" />
        <span className="text-lg font-semibold">SpectralAnalysis</span>
      </div>
      <nav className="hidden md:flex flex-1 items-center gap-6 text-sm">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => setActiveSection(item.id)}
          >
            <item.icon className="size-4" />
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {onBackToUpload && (
          <Button variant="outline" onClick={onBackToUpload}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Upload
          </Button>
        )}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Help">
              <HelpCircle className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Help & Documentation</h2>
                <p className="text-muted-foreground">Learn how to use the spectral analysis tools and features.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Getting Started</h3>
                  <p>
                    Your spectral data has been successfully uploaded and validated. You can now explore different
                    analysis modules using the sidebar navigation.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Analysis Tools</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Data Overview: View and explore your uploaded data</li>
                    <li>Functionalization: Convert discrete data to functional form</li>
                    <li>Exploratory Analysis: Basic statistical analysis and visualization</li>
                    <li>FPCA: Functional Principal Component Analysis</li>
                    <li>FPCR: Functional Principal Component Regression (requires scalar variables)</li>
                    <li>FPCLoR: Functional Principal Component Logistic Regression (requires scalar variables)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Need More Help?</h3>
                  <p>
                    Contact our support team at support@spectralanalysis.com or visit our documentation website for
                    detailed guides and tutorials.
                  </p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

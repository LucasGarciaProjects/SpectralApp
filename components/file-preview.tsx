"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import type { FileData } from "@/components/data-upload-module"

interface FilePreviewProps {
  file: FileData
}

export function FilePreview({ file }: FilePreviewProps) {
  const [page, setPage] = useState(0)
  const rowsPerPage = 5
  const maxColumns = 10

  // Parse the file content to get all rows
  const rows = file.content.split(/\r\n|\n/).filter((line) => line.trim() !== "")

  // Determine the separator based on the first line
  const separator = rows[0].includes(";") ? ";" : ","

  // Get the total number of rows (excluding header if hasHeaders is true)
  const dataStartIndex = file.hasHeaders ? 1 : 0
  const totalDataRows = rows.length - dataStartIndex
  const totalPages = Math.ceil(totalDataRows / rowsPerPage)

  // Get the current page of rows
  const startIndex = dataStartIndex + page * rowsPerPage
  const currentRows = rows.slice(startIndex, startIndex + rowsPerPage)

  // Parse each row into columns
  const parsedRows = currentRows.map((row) => row.split(separator).slice(0, maxColumns))

  // Determine if we need to show "more columns" indicator
  const hasMoreColumns = parsedRows.some((row) => row.length === maxColumns)

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Row</TableHead>
              {file.headers.slice(0, maxColumns).map((header, i) => (
                <TableHead key={i}>
                  {header}
                  {i === maxColumns - 1 && hasMoreColumns && "..."}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedRows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell className="font-medium">{startIndex + rowIndex + 1}</TableCell>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className="max-w-[100px] truncate">
                    {cell}
                  </TableCell>
                ))}
                {row.length < maxColumns &&
                  Array.from({ length: maxColumns - row.length }).map((_, i) => (
                    <TableCell key={`empty-${i}`}></TableCell>
                  ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing rows {startIndex + 1}-{Math.min(startIndex + rowsPerPage, rows.length)} of {rows.length}
            {file.hasHeaders && " (excluding header row)"}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

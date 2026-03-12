'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'

/* ─── Types ─── */

export interface ExportColumn {
  key: string
  label: string
  format?: (value: unknown) => string
}

interface ExportButtonProps {
  data: Record<string, unknown>[]
  columns: ExportColumn[]
  filename: string
  variant?: 'default' | 'compact'
}

/* ─── Utilitaires internes ─── */

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Construit les lignes d'export avec formatage des colonnes */
function buildExportRows(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
): Record<string, string | number>[] {
  return data.map(row => {
    const exportRow: Record<string, string | number> = {}
    for (const col of columns) {
      const raw = row[col.key]
      if (col.format) {
        exportRow[col.label] = col.format(raw)
      } else if (raw == null) {
        exportRow[col.label] = ''
      } else {
        exportRow[col.label] = raw as string | number
      }
    }
    return exportRow
  })
}

/* ─── Composant principal ─── */

export default function ExportButton({ data, columns, filename, variant = 'default' }: ExportButtonProps) {
  const [open, setOpen] = useState(false)

  if (data.length === 0) return null

  function exportCsv() {
    const rows = buildExportRows(data, columns)
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csvLines = [
      headers.join(';'),
      ...rows.map(r =>
        headers
          .map(h => {
            const str = String(r[h] ?? '')
            return str.includes(';') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str
          })
          .join(';'),
      ),
    ]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    downloadBlob(blob, `${filename}_${todayStr()}.csv`)
    setOpen(false)
  }

  function exportXlsx() {
    const rows = buildExportRows(data, columns)
    if (rows.length === 0) return
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Export')
    XLSX.writeFile(wb, `${filename}_${todayStr()}.xlsx`)
    setOpen(false)
  }

  const isCompact = variant === 'compact'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg text-sm font-medium transition-opacity"
        style={
          isCompact
            ? { color: '#6B7B6C', padding: '6px 10px', border: '1px solid #D8E0D9' }
            : { backgroundColor: 'var(--color-primary)', color: '#F9F8F6', padding: '8px 16px' }
        }
      >
        Exporter
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 z-20 rounded-lg shadow-lg border py-1"
            style={{ backgroundColor: '#FAFAF8', borderColor: '#D8E0D9', minWidth: '140px' }}
          >
            <button
              onClick={exportCsv}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              style={{ color: '#2C3E2D' }}
            >
              Export CSV
            </button>
            <button
              onClick={exportXlsx}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              style={{ color: '#2C3E2D' }}
            >
              Export XLSX
            </button>
          </div>
        </>
      )}
    </div>
  )
}

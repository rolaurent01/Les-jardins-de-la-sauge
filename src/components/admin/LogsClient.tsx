'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { AppLog, LogFilters, LogCounts } from '@/app/[orgSlug]/(dashboard)/admin/logs/actions'
import { purgeLogs } from '@/app/[orgSlug]/(dashboard)/admin/logs/actions'

// Styles des badges par niveau
const LEVEL_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  info:  { bg: '#DBEAFE', color: '#1D4ED8', label: 'Info' },
  warn:  { bg: '#FEF3C7', color: '#D97706', label: 'Warn' },
  error: { bg: '#FEE2E2', color: '#DC2626', label: 'Error' },
}

function LevelBadge({ level }: { level: string }) {
  const style = LEVEL_STYLES[level] ?? LEVEL_STYLES.info
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  )
}

type Props = {
  initialLogs: AppLog[]
  total: number
  page: number
  pageSize: number
  counts: LogCounts
  sources: string[]
  currentFilters: LogFilters
}

export default function LogsClient({
  initialLogs,
  total,
  page,
  pageSize,
  counts,
  sources,
  currentFilters,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Filtres locaux
  const [level, setLevel] = useState<string>(currentFilters.level ?? '')
  const [source, setSource] = useState(currentFilters.source ?? '')
  const [dateFrom, setDateFrom] = useState(currentFilters.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(currentFilters.dateTo ?? '')
  const [search, setSearch] = useState(currentFilters.search ?? '')

  // Détail d'une ligne
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Purge
  const [purgeDays, setPurgeDays] = useState(90)
  const [purgeConfirm, setPurgeConfirm] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)

  const totalPages = Math.ceil(total / pageSize)

  /** Applique les filtres via la query string (SSR) */
  function applyFilters(overrides: Partial<LogFilters> = {}) {
    const params = new URLSearchParams()
    const f = {
      level: overrides.level !== undefined ? overrides.level : level,
      source: overrides.source !== undefined ? overrides.source : source,
      dateFrom: overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom,
      dateTo: overrides.dateTo !== undefined ? overrides.dateTo : dateTo,
      search: overrides.search !== undefined ? overrides.search : search,
      page: overrides.page !== undefined ? overrides.page : 1,
    }

    if (f.level) params.set('level', f.level)
    if (f.source) params.set('source', f.source)
    if (f.dateFrom) params.set('dateFrom', f.dateFrom)
    if (f.dateTo) params.set('dateTo', f.dateTo)
    if (f.search) params.set('search', f.search)
    if (f.page && f.page > 1) params.set('page', String(f.page))

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  /** Pagination */
  function goToPage(p: number) {
    applyFilters({ page: p })
  }

  /** Purge des anciens logs */
  async function handlePurge() {
    if (!purgeConfirm) {
      setPurgeConfirm(true)
      return
    }
    setPurgeConfirm(false)
    setPurgeResult(null)
    const result = await purgeLogs(purgeDays)
    if ('error' in result) {
      setPurgeResult(`Erreur : ${result.error}`)
    } else {
      setPurgeResult(`${result.data?.deleted ?? 0} logs supprimés.`)
      startTransition(() => router.refresh())
    }
  }

  /** Formatage de la date */
  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="p-6" style={{ maxWidth: '1200px' }}>
      <h1 className="text-lg font-semibold mb-4" style={{ color: '#1F2937' }}>
        Logs applicatifs
      </h1>

      {/* Compteurs par niveau */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'info', 'warn', 'error'] as const).map(lvl => {
          const count = lvl === '' ? counts.total : counts[lvl]
          const isActive = level === lvl
          return (
            <button
              key={lvl}
              onClick={() => {
                setLevel(lvl)
                applyFilters({ level: lvl || null })
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                border: isActive ? '2px solid #DC2626' : '1px solid #D1D5DB',
                backgroundColor: isActive ? '#FEF2F2' : '#fff',
                color: isActive ? '#DC2626' : '#4B5563',
                cursor: 'pointer',
              }}
            >
              {lvl === '' ? 'Tous' : LEVEL_STYLES[lvl].label} ({count})
            </button>
          )
        })}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-4 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-logs-source" className="text-xs" style={{ color: '#6B7280' }}>Source</label>
          <select
            id="admin-logs-source"
            value={source}
            onChange={e => {
              setSource(e.target.value)
              applyFilters({ source: e.target.value || null })
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '13px',
              minWidth: '140px',
            }}
          >
            <option value="">Toutes</option>
            {sources.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="admin-logs-date-from" className="text-xs" style={{ color: '#6B7280' }}>Du</label>
          <input
            id="admin-logs-date-from"
            type="date"
            value={dateFrom}
            onChange={e => {
              setDateFrom(e.target.value)
              applyFilters({ dateFrom: e.target.value || null })
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '13px',
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="admin-logs-date-to" className="text-xs" style={{ color: '#6B7280' }}>Au</label>
          <input
            id="admin-logs-date-to"
            type="date"
            value={dateTo}
            onChange={e => {
              setDateTo(e.target.value)
              applyFilters({ dateTo: e.target.value || null })
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '13px',
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="admin-logs-search" className="text-xs" style={{ color: '#6B7280' }}>Recherche</label>
          <form
            onSubmit={e => {
              e.preventDefault()
              applyFilters({ search: search || null })
            }}
            className="flex gap-1"
          >
            <input
              id="admin-logs-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="message ou metadata..."
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                minWidth: '200px',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#374151',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Filtrer
            </button>
          </form>
        </div>
      </div>

      {/* Tableau des logs */}
      <div
        style={{
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          overflow: 'hidden',
          opacity: isPending ? 0.6 : 1,
          transition: 'opacity 200ms',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <th style={{ ...thStyle, width: '70px' }}>Niveau</th>
              <th style={{ ...thStyle, width: '100px' }}>Source</th>
              <th style={thStyle}>Message</th>
              <th style={{ ...thStyle, width: '160px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {initialLogs.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>
                  Aucun log trouvé.
                </td>
              </tr>
            )}
            {initialLogs.map(log => (
              <LogRow
                key={log.id}
                log={log}
                isExpanded={expandedId === log.id}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                formatDate={formatDate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <span style={{ fontSize: '13px', color: '#6B7280' }}>
          Page {page} / {totalPages || 1} — {total} résultat{total !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            style={{
              ...paginationBtnStyle,
              opacity: page <= 1 ? 0.4 : 1,
              cursor: page <= 1 ? 'default' : 'pointer',
            }}
          >
            Précédent
          </button>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            style={{
              ...paginationBtnStyle,
              opacity: page >= totalPages ? 0.4 : 1,
              cursor: page >= totalPages ? 'default' : 'pointer',
            }}
          >
            Suivant
          </button>
        </div>
      </div>

      {/* Section purge */}
      <div
        className="mt-6"
        style={{
          padding: '16px',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          backgroundColor: '#FEF2F2',
        }}
      >
        <h3 className="font-semibold text-sm mb-2" style={{ color: '#991B1B' }}>
          Purger les anciens logs
        </h3>
        <div className="flex items-center gap-3">
          <label htmlFor="admin-logs-purge-days" className="text-xs" style={{ color: '#6B7280' }}>
            Supprimer les logs de plus de
          </label>
          <input
            id="admin-logs-purge-days"
            type="number"
            min={1}
            value={purgeDays}
            onChange={e => {
              setPurgeDays(parseInt(e.target.value) || 90)
              setPurgeConfirm(false)
            }}
            style={{
              width: '70px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '13px',
            }}
          />
          <span className="text-xs" style={{ color: '#6B7280' }}>jours</span>
          <button
            onClick={handlePurge}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: purgeConfirm ? '#DC2626' : '#EF4444',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {purgeConfirm ? 'Confirmer la purge' : 'Purger'}
          </button>
        </div>
        {purgeResult && (
          <p className="mt-2 text-xs" style={{ color: '#374151' }}>{purgeResult}</p>
        )}
      </div>
    </div>
  )
}

/** Ligne de log avec expansion au clic */
function LogRow({
  log,
  isExpanded,
  onToggle,
  formatDate,
}: {
  log: AppLog
  isExpanded: boolean
  onToggle: () => void
  formatDate: (iso: string) => string
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderTop: '1px solid #E5E7EB',
          cursor: 'pointer',
          backgroundColor: isExpanded ? '#F3F4F6' : 'transparent',
        }}
        onMouseEnter={e => {
          if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB'
        }}
        onMouseLeave={e => {
          if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
        }}
      >
        <td style={tdStyle}><LevelBadge level={log.level} /></td>
        <td style={tdStyle}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{log.source}</span>
        </td>
        <td style={{ ...tdStyle, maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.message}
        </td>
        <td style={tdStyle}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{formatDate(log.created_at)}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ backgroundColor: '#F3F4F6' }}>
          <td colSpan={4} style={{ padding: '12px 16px' }}>
            <div className="mb-2">
              <span className="font-semibold text-xs" style={{ color: '#374151' }}>Message complet :</span>
              <p className="mt-1 text-sm" style={{ color: '#1F2937', whiteSpace: 'pre-wrap' }}>
                {log.message}
              </p>
            </div>
            {log.metadata && (
              <div>
                <span className="font-semibold text-xs" style={{ color: '#374151' }}>Metadata :</span>
                <pre
                  className="mt-1"
                  style={{
                    fontSize: '12px',
                    backgroundColor: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    overflow: 'auto',
                    maxHeight: '300px',
                    color: '#374151',
                  }}
                >
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '12px',
  color: '#6B7280',
  borderBottom: '1px solid #E5E7EB',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 16px',
  color: '#1F2937',
}

const paginationBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  backgroundColor: '#fff',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
}

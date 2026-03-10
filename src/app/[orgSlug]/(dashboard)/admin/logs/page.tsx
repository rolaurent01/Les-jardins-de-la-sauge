import { fetchLogs, countLogsByLevel, fetchLogSources } from './actions'
import LogsClient from '@/components/admin/LogsClient'

export const metadata = { title: 'Logs — Admin' }

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  try {
    const sp = await searchParams
    const filters = {
      level: (sp.level as 'info' | 'warn' | 'error') || null,
      source: sp.source || null,
      dateFrom: sp.dateFrom || null,
      dateTo: sp.dateTo || null,
      search: sp.search || null,
      page: sp.page ? parseInt(sp.page) : 1,
    }

    const [logsResult, counts, sources] = await Promise.all([
      fetchLogs(filters),
      countLogsByLevel(),
      fetchLogSources(),
    ])

    return (
      <LogsClient
        initialLogs={logsResult.logs}
        total={logsResult.total}
        page={logsResult.page}
        pageSize={logsResult.pageSize}
        counts={counts}
        sources={sources}
        currentFilters={filters}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur : {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }
}

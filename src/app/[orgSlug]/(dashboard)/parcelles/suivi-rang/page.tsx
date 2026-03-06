import { fetchRowCare } from './actions'
import { fetchRowsForSelect, fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import SuiviRangClient from '@/components/parcelles/SuiviRangClient'

export const metadata = { title: 'Suivi de rang — LJS' }

export default async function SuiviRangPage() {
  try {
    const [rowCareList, rows, varieties] = await Promise.all([
      fetchRowCare(),
      fetchRowsForSelect(),
      fetchVarietiesForSelect(),
    ])

    return (
      <SuiviRangClient
        initialRowCare={rowCareList}
        rows={rows}
        varieties={varieties}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement :{' '}
          {err instanceof Error ? err.message : 'Erreur inconnue'}
        </p>
      </div>
    )
  }
}

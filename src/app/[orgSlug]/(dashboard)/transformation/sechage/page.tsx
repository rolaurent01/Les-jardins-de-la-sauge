import { fetchDryings, createDrying, updateDrying, deleteDrying } from './actions'
import { fetchVarietiesForSelect } from '@/app/[orgSlug]/(dashboard)/parcelles/shared-actions'
import TransformationClient from '@/components/transformation/TransformationClient'
import { SECHAGE_CONFIG } from '@/components/transformation/types'
import type { TransformationItem } from '@/components/transformation/types'

export const metadata = { title: 'Sechage — Carnet Culture' }

export default async function SechagePage() {
  try {
    const [items, varieties] = await Promise.all([
      fetchDryings(),
      fetchVarietiesForSelect(),
    ])

    return (
      <TransformationClient
        config={SECHAGE_CONFIG}
        items={items as unknown as TransformationItem[]}
        varieties={varieties}
        actions={{ create: createDrying, update: updateDrying, delete: deleteDrying }}
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

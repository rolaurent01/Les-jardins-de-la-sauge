import { fetchAdjustments, createAdjustment, updateAdjustment, deleteAdjustment } from './actions'
import { fetchVarietiesForAffinage, fetchStockLevelsForAffinage } from '../shared-actions'
import AjustementsClient from '@/components/affinage-stock/AjustementsClient'

export const metadata = { title: 'Ajustements — Carnet Culture' }

export default async function AjustementsPage() {
  try {
    const [adjustments, varieties, stockLevels] = await Promise.all([
      fetchAdjustments(),
      fetchVarietiesForAffinage(),
      fetchStockLevelsForAffinage(),
    ])

    return (
      <AjustementsClient
        adjustments={adjustments}
        varieties={varieties}
        stockLevels={stockLevels}
        actions={{ create: createAdjustment, update: updateAdjustment, delete: deleteAdjustment }}
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

import {
  fetchSeedStockLevels,
  fetchSeedAdjustments,
  fetchActiveSeedLots,
  createSeedAdjustment,
  updateSeedAdjustment,
  deleteSeedAdjustment,
} from './actions'
import SeedStockClient from '@/components/seed-stock/SeedStockClient'

export const metadata = { title: 'Stock graines — Carnet Culture' }

export default async function SeedStockPage() {
  try {
    const [stockLevels, adjustments, seedLots] = await Promise.all([
      fetchSeedStockLevels(),
      fetchSeedAdjustments(),
      fetchActiveSeedLots(),
    ])

    return (
      <SeedStockClient
        stockLevels={stockLevels}
        adjustments={adjustments}
        seedLots={seedLots}
        actions={{
          create: createSeedAdjustment,
          update: updateSeedAdjustment,
          delete: deleteSeedAdjustment,
        }}
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

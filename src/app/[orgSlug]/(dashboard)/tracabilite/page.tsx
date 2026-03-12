import TracabiliteClient from '@/components/tracabilite/TracabiliteClient'
import { searchProductionLots } from './actions'

export const metadata = {
  title: 'Traçabilité',
}

export default async function TracabilitePage() {
  // Charger les 20 derniers lots au montage
  const recentLots = await searchProductionLots('')

  return <TracabiliteClient initialLots={recentLots} />
}

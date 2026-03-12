import { fetchStock, fetchStockAlerts } from './actions'
import VueStockClient from '@/components/stock/VueStockClient'

export const metadata = {
  title: 'Vue Stock',
}

export default async function VueStockPage() {
  const [stock, alerts] = await Promise.all([
    fetchStock(),
    fetchStockAlerts(),
  ])

  return <VueStockClient entries={stock} alerts={alerts} />
}

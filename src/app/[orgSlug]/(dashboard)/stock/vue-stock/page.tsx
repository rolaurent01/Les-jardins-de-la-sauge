import { fetchStock, fetchStockAlerts, fetchStockYears } from './actions'
import VueStockClient from '@/components/stock/VueStockClient'

export const metadata = {
  title: 'Vue Stock',
}

export default async function VueStockPage() {
  const [stock, alerts, years] = await Promise.all([
    fetchStock(),
    fetchStockAlerts(),
    fetchStockYears(),
  ])

  return <VueStockClient entries={stock} alerts={alerts} years={years} />
}

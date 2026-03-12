import { fetchProductionSummary, fetchForecastsForProduction, fetchAvailableYears } from './actions'
import VueProductionClient from '@/components/production/VueProductionClient'

export const metadata = {
  title: 'Vue Production totale',
}

export default async function VueProductionPage() {
  const currentYear = new Date().getFullYear()

  const [summary, forecasts, years] = await Promise.all([
    fetchProductionSummary(currentYear),
    fetchForecastsForProduction(currentYear),
    fetchAvailableYears(),
  ])

  return (
    <VueProductionClient
      initialData={summary}
      initialForecasts={forecasts}
      initialYear={currentYear}
      availableYears={years}
    />
  )
}

import { fetchForecasts, fetchForecastYears, fetchVarietiesForForecast, fetchRealisedByVariety } from './actions'
import PrevisionnelClient from '@/components/previsionnel/PrevisionnelClient'

export const metadata = { title: 'Prévisionnel — LJS' }

export default async function PrevisionnelPage() {
  try {
    const currentYear = new Date().getFullYear()

    const [forecasts, years, varieties, realised] = await Promise.all([
      fetchForecasts(currentYear),
      fetchForecastYears(),
      fetchVarietiesForForecast(),
      fetchRealisedByVariety(currentYear),
    ])

    return (
      <PrevisionnelClient
        initialForecasts={forecasts}
        initialYears={years}
        initialYear={currentYear}
        allVarieties={varieties}
        initialRealised={realised}
      />
    )
  } catch (err) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement : {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }
}

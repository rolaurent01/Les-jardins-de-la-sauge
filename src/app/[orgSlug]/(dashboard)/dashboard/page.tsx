import { getContext } from '@/lib/context'
import {
  fetchDashboardStock,
  fetchDashboardProduction,
  fetchDashboardParcelles,
  fetchDashboardTemps,
  fetchDashboardAvancement,
  fetchDashboardActiviteRecente,
} from './actions'
import { DashboardStockWidget } from '@/components/dashboard/DashboardStockWidget'
import { DashboardProductionWidget } from '@/components/dashboard/DashboardProductionWidget'
import { DashboardParcellesWidget } from '@/components/dashboard/DashboardParcellesWidget'
import { DashboardAvancementWidget } from '@/components/dashboard/DashboardAvancementWidget'
import { DashboardTempsWidget } from '@/components/dashboard/DashboardTempsWidget'
import { DashboardActiviteWidget } from '@/components/dashboard/DashboardActiviteWidget'

/**
 * Page dashboard — centre de commande avec 6 widgets.
 */
export default async function DashboardPage() {
  const { farmId, orgSlug } = await getContext()
  const currentYear = new Date().getFullYear()

  // Chargement parallèle — chaque widget est indépendant
  const [stock, production, parcelles, temps, avancement, activite] = await Promise.allSettled([
    fetchDashboardStock(farmId),
    fetchDashboardProduction(farmId, currentYear),
    fetchDashboardParcelles(farmId),
    fetchDashboardTemps(farmId, currentYear),
    fetchDashboardAvancement(farmId, currentYear),
    fetchDashboardActiviteRecente(farmId),
  ])

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: '#F9F8F6', minHeight: '100%' }}>
      {/* En-tête */}
      <div className="mb-6 md:mb-8">
        <h1
          className="text-xl md:text-2xl font-semibold"
          style={{ color: '#2C3E2D' }}
        >
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: '#9CA89D' }}>
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Stock */}
        {stock.status === 'fulfilled' ? (
          <DashboardStockWidget data={stock.value} orgSlug={orgSlug} />
        ) : (
          <WidgetError title="📦 Stock" />
        )}

        {/* Production */}
        {production.status === 'fulfilled' ? (
          <DashboardProductionWidget data={production.value} orgSlug={orgSlug} />
        ) : (
          <WidgetError title="📈 Production" />
        )}

        {/* Avancement prévisionnel */}
        {avancement.status === 'fulfilled' ? (
          <DashboardAvancementWidget data={avancement.value} orgSlug={orgSlug} />
        ) : (
          <WidgetError title="🎯 Avancement" />
        )}

        {/* Temps de travail */}
        {temps.status === 'fulfilled' ? (
          <DashboardTempsWidget data={temps.value} orgSlug={orgSlug} />
        ) : (
          <WidgetError title="⏱️ Temps de travail" />
        )}

        {/* Activité récente — pleine largeur */}
        {activite.status === 'fulfilled' ? (
          <DashboardActiviteWidget data={activite.value} />
        ) : (
          <WidgetError title="🕐 Activité récente" className="md:col-span-2" />
        )}

        {/* Vue Parcelles — pleine largeur, en bas */}
        {parcelles.status === 'fulfilled' ? (
          <DashboardParcellesWidget data={parcelles.value} />
        ) : (
          <WidgetError title="🗺️ Vue Parcelles" className="md:col-span-2" />
        )}
      </div>
    </div>
  )
}

/** Widget d'erreur générique en cas de rejet d'une promesse */
function WidgetError({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 border ${className ?? ''}`}
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <h2 className="text-base font-bold mb-2" style={{ color: '#2C3E2D' }}>
        {title}
      </h2>
      <p className="text-sm" style={{ color: '#EF4444' }}>
        Erreur de chargement. Rechargez la page.
      </p>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'

/**
 * Page dashboard — point d'entrée après connexion.
 * Les widgets (stocks, parcelles, prévisionnel) seront ajoutés en Phase B.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold"
          style={{ color: '#2C3E2D' }}
        >
          Bonjour 🌿
        </h1>
        <p className="text-sm mt-1" style={{ color: '#9CA89D' }}>
          {user?.email} — Les Jardins de la Sauge
        </p>
      </div>

      {/* Grille de modules — placeholders Phase B */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {DASHBOARD_CARDS.map(card => (
          <div
            key={card.id}
            className="rounded-xl p-5 border"
            style={{
              backgroundColor: '#FAF5E9',
              borderColor: '#D8E0D9',
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{card.emoji}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: '#3A5A4015',
                  color: '#588157',
                }}
              >
                Phase B
              </span>
            </div>
            <h3
              className="text-sm font-medium"
              style={{ color: '#2C3E2D' }}
            >
              {card.label}
            </h3>
            <p className="text-xs mt-1" style={{ color: '#9CA89D' }}>
              {card.description}
            </p>
          </div>
        ))}
      </div>

      {/* Banner Phase A en cours */}
      <div
        className="rounded-xl p-5 border"
        style={{
          backgroundColor: '#F5F9F5',
          borderColor: '#3A5A4030',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔧</span>
          <div>
            <p className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
              Phase A en cours — Référentiel & Saisie
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA89D' }}>
              Configurez d'abord vos variétés, sites et parcelles via le menu Référentiel.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const DASHBOARD_CARDS = [
  {
    id: 'stocks',
    emoji: '📦',
    label: 'État des stocks',
    description: 'Stocks par variété et état (frais, séché, trié…)',
  },
  {
    id: 'parcelles',
    emoji: '🌿',
    label: 'Parcelles actives',
    description: 'Plantations en cours, rangs occupés par variété',
  },
  {
    id: 'production',
    emoji: '🧪',
    label: 'Production',
    description: 'Lots produits ce mois, cumul annuel par variété',
  },
  {
    id: 'previsionnel',
    emoji: '📊',
    label: 'Prévisionnel',
    description: 'Avancement vs objectifs annuels',
  },
  {
    id: 'temps',
    emoji: '⏱️',
    label: 'Temps de travail',
    description: 'Répartition par module ce mois',
  },
  {
    id: 'alertes',
    emoji: '🔔',
    label: 'Alertes stock bas',
    description: 'Variétés sous le seuil d\'alerte défini',
  },
]

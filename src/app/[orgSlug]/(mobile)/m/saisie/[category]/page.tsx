import Link from 'next/link'
import { notFound } from 'next/navigation'

/** Mapping catégorie → sous-actions */
const MOBILE_ACTIONS: Record<string, { id: string; label: string; emoji: string }[]> = {
  semis: [
    { id: 'sachet', label: 'Sachet de graines', emoji: '🌰' },
    { id: 'suivi-semis', label: 'Suivi semis', emoji: '🌱' },
  ],
  parcelle: [
    { id: 'travail-sol', label: 'Travail de sol', emoji: '🌍' },
    { id: 'plantation', label: 'Plantation', emoji: '🌿' },
    { id: 'suivi-rang', label: 'Suivi de rang', emoji: '📋' },
    { id: 'cueillette', label: 'Cueillette', emoji: '✂️' },
    { id: 'arrachage', label: 'Arrachage', emoji: '🔄' },
    { id: 'occultation', label: 'Occultation', emoji: '🛡️' },
  ],
  transfo: [
    { id: 'tronconnage', label: 'Tronçonnage', emoji: '🔪' },
    { id: 'sechage', label: 'Séchage', emoji: '☀️' },
    { id: 'triage', label: 'Triage', emoji: '🔍' },
  ],
  stock: [
    { id: 'achat', label: 'Achat', emoji: '🛒' },
    { id: 'vente', label: 'Vente directe', emoji: '💰' },
  ],
  produits: [
    { id: 'production', label: 'Production de lot', emoji: '🏭' },
  ],
}

/** Labels des catégories pour le titre */
const CATEGORY_LABELS: Record<string, string> = {
  semis: 'Semis',
  parcelle: 'Parcelle',
  transfo: 'Transformation',
  stock: 'Stock',
  produits: 'Produits',
}

/**
 * Page de sous-actions pour une catégorie mobile.
 * Affiche les actions disponibles sous forme de tuiles.
 */
export default async function MobileCategoryPage({
  params,
}: {
  params: Promise<{ orgSlug: string; category: string }>
}) {
  const { orgSlug, category } = await params
  const actions = MOBILE_ACTIONS[category]

  if (!actions) notFound()

  const categoryLabel = CATEGORY_LABELS[category] ?? category

  return (
    <div className="flex-1 px-4 py-4">
      {/* Bouton retour + titre */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href={`/${orgSlug}/m/saisie`}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
        >
          <span className="text-lg" style={{ color: '#2C3E2D' }}>←</span>
        </Link>
        <h1
          className="text-lg font-semibold"
          style={{ color: '#2C3E2D' }}
        >
          {categoryLabel}
        </h1>
      </div>

      {/* Grille de sous-actions */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, idx) => {
          const isLast = idx === actions.length - 1 && actions.length % 2 !== 0
          return (
            <Link
              key={action.id}
              href={`/${orgSlug}/m/saisie/${category}/${action.id}`}
              className={`
                flex flex-col items-center justify-center gap-2
                bg-white rounded-2xl
                active:scale-95 active:opacity-80
                transition-transform
                ${isLast ? 'col-span-2' : ''}
              `}
              style={{
                minHeight: '88px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <span className="text-2xl">{action.emoji}</span>
              <span
                className="text-xs font-medium text-center px-2"
                style={{ color: '#2C3E2D' }}
              >
                {action.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

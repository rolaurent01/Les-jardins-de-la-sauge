import Link from 'next/link'

/** Tuiles de l'écran principal mobile */
const TILES = [
  { id: 'semis', label: 'Semis', emoji: '🌱' },
  { id: 'parcelle', label: 'Parcelle', emoji: '🌿' },
  { id: 'transfo', label: 'Transfo', emoji: '🔄' },
  { id: 'stock', label: 'Stock', emoji: '📦' },
  { id: 'produits', label: 'Produits', emoji: '🧪' },
] as const

/**
 * Écran principal mobile — grille de 5 grosses tuiles tactiles.
 * Chaque tuile mène à la page de sous-actions de la catégorie.
 */
export default async function MobileSaisiePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <div className="flex-1 px-4 py-6">
      <h1
        className="text-lg font-semibold mb-5 text-center"
        style={{ color: '#2C3E2D' }}
      >
        Saisie terrain
      </h1>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map((tile, idx) => {
          // Dernière tuile (impaire) : pleine largeur
          const isLast = idx === TILES.length - 1 && TILES.length % 2 !== 0
          return (
            <Link
              key={tile.id}
              href={`/${orgSlug}/m/saisie/${tile.id}`}
              className={`
                flex flex-col items-center justify-center gap-2
                bg-white rounded-2xl
                active:scale-95 active:opacity-80
                transition-transform
                ${isLast ? 'col-span-2' : ''}
              `}
              style={{
                minHeight: '100px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <span className="text-3xl">{tile.emoji}</span>
              <span
                className="text-sm font-medium"
                style={{ color: '#2C3E2D' }}
              >
                {tile.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

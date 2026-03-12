'use client'

import { useState, useTransition, useCallback } from 'react'
import { searchProductionLots, fetchLotTraceability } from '@/app/[orgSlug]/(dashboard)/tracabilite/actions'
import type { LotSearchResult, LotTraceability, IngredientTrace } from '@/app/[orgSlug]/(dashboard)/tracabilite/actions'
import { ETAT_PLANTE_LABELS, ETAT_PLANTE_COLORS } from '@/lib/constants/etat-plante'
import { PARTIE_COLORS } from '@/lib/utils/colors'
import type { PartiePlante } from '@/lib/types'

/* ---------------------------------------------------------------
   Helpers de formatage
--------------------------------------------------------------- */

function formatDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPoids(g: number): string {
  if (g === 0) return '—'
  if (g >= 1000) return `${(g / 1000).toFixed(1).replace('.0', '')} kg`
  return `${Math.round(g)} g`
}

function formatTemps(min: number | null): string {
  if (!min || min === 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

/* ---------------------------------------------------------------
   Export texte — génère un fichier .txt téléchargeable
--------------------------------------------------------------- */

function generateTraceText(trace: LotTraceability): string {
  const { lot, ingredients } = trace
  const lines: string[] = []

  lines.push(`LOT ${lot.numero_lot} — ${lot.recipe_nom}${lot.category_nom ? ` — ${lot.category_nom}` : ''}`)
  lines.push(`Produit le ${formatDate(lot.date_production)}${lot.ddm ? ` — DDM ${formatDate(lot.ddm)}` : ''}`)

  if (lot.nb_unites && lot.recipe_poids_sachet_g) {
    lines.push(`${lot.nb_unites} sachets × ${lot.recipe_poids_sachet_g}g = ${formatPoids(lot.poids_total_g ?? 0)}`)
  } else if (lot.poids_total_g) {
    lines.push(`Poids total : ${formatPoids(lot.poids_total_g)}`)
  }

  if (lot.temps_min) lines.push(`Temps : ${formatTemps(lot.temps_min)}`)
  if (lot.commentaire) lines.push(`Note : ${lot.commentaire}`)

  lines.push('')

  ingredients.forEach((ing, idx) => {
    const etatLabel = ing.etat_plante ? ETAT_PLANTE_LABELS[ing.etat_plante] ?? ing.etat_plante : ''
    const partieLabel = ing.partie_plante ?? ''
    const detailParts = [etatLabel, partieLabel].filter(Boolean).join(', ')

    lines.push(`INGRÉDIENT ${idx + 1} : ${ing.nom} (${ing.pourcentage}%, ${formatPoids(ing.poids_g)}${detailParts ? `, ${detailParts}` : ''})`)

    if (ing.is_external) {
      if (ing.fournisseur) lines.push(`  Fournisseur : ${ing.fournisseur}`)
      lines.push('')
      return
    }

    if (ing.cueillettes.length > 0) {
      const year = ing.annee_recolte ?? new Date(ing.cueillettes[0].date).getFullYear()
      lines.push(`  Cueillettes ${year} :`)
      for (const c of ing.cueillettes) {
        lines.push(`    - ${formatDate(c.date)} — ${formatPoids(c.poids_g)} — ${c.lieu}`)
      }
    }

    for (const p of ing.plantations) {
      lines.push(`  Plantation : ${p.rang} — ${p.nb_plants ?? '?'} plants ${p.type_plant ?? ''}`)
      if (p.seedling_numero) {
        lines.push(`    Semis : ${p.seedling_numero}${p.seedling_date_semis ? ` (${formatDate(p.seedling_date_semis)})` : ''}`)
      }
      if (p.seed_lot_interne) {
        lines.push(`    Sachet : ${p.seed_lot_interne}${p.seed_fournisseur ? ` — ${p.seed_fournisseur}` : ''}${p.seed_certif_ab ? ' — Certif AB' : ''}`)
      }
    }

    lines.push('')
  })

  return lines.join('\n')
}

function downloadTraceText(trace: LotTraceability) {
  const text = generateTraceText(trace)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tracabilite_${trace.lot.numero_lot}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

/* ---------------------------------------------------------------
   Badge composants
--------------------------------------------------------------- */

function EtatBadge({ etat }: { etat: string }) {
  const label = ETAT_PLANTE_LABELS[etat] ?? etat
  const color = ETAT_PLANTE_COLORS[etat] ?? '#6B7280'
  return (
    <span
      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  )
}

function PartieBadge({ partie }: { partie: string }) {
  const colors = PARTIE_COLORS[partie as PartiePlante]
  if (!colors) return <span className="text-[11px] text-gray-500">{partie}</span>
  return (
    <span
      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: colors.bg, color: colors.color }}
    >
      {partie.replace('_', ' ')}
    </span>
  )
}

function CertifAbBadge() {
  return (
    <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
      AB
    </span>
  )
}

/* ---------------------------------------------------------------
   Accordéon ingrédient
--------------------------------------------------------------- */

function IngredientAccordion({
  ing,
  defaultOpen,
}: {
  ing: IngredientTrace
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const etatLabel = ing.etat_plante ? (ETAT_PLANTE_LABELS[ing.etat_plante] ?? ing.etat_plante) : null

  return (
    <div
      className="border-l-3 rounded-r-lg transition-colors"
      style={{
        borderLeftColor: ing.is_external ? '#9CA3AF' : 'var(--color-primary, #4A7C59)',
        backgroundColor: open ? '#FAFAF8' : 'transparent',
      }}
    >
      {/* En-tête cliquable */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#F5F5F0] transition-colors rounded-r-lg"
      >
        <span className="text-sm flex-shrink-0">{open ? '▼' : '▶'}</span>
        <span className="text-base flex-shrink-0">
          {ing.is_external ? '📦' : '🌿'}
        </span>
        <span className="font-medium text-[14px] text-gray-900">{ing.nom}</span>
        <span className="text-[13px] text-gray-500">
          — {ing.pourcentage}% ({formatPoids(ing.poids_g)})
        </span>
        {etatLabel && <EtatBadge etat={ing.etat_plante!} />}
        {ing.partie_plante && <PartieBadge partie={ing.partie_plante} />}
      </button>

      {/* Contenu déplié */}
      {open && (
        <div className="pl-12 pr-4 pb-4 space-y-4">
          {/* Matériau externe — juste le fournisseur */}
          {ing.is_external && (
            <div className="text-[13px] text-gray-600">
              {ing.fournisseur
                ? <span>Fournisseur : <strong>{ing.fournisseur}</strong></span>
                : <span className="italic">Pas de fournisseur renseigné</span>}
            </div>
          )}

          {/* Cueillettes */}
          {!ing.is_external && ing.cueillettes.length > 0 && (
            <div>
              <h4 className="text-[13px] font-semibold text-gray-700 mb-2">
                Cueillettes {ing.annee_recolte ?? ''} ({ing.cueillettes.length})
              </h4>
              <div className="space-y-1.5">
                {ing.cueillettes.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-[13px] text-gray-700">
                    <span className="flex-shrink-0">🌿</span>
                    <span className="font-medium">{formatDate(c.date)}</span>
                    <span>— {formatPoids(c.poids_g)}</span>
                    <span className="text-gray-500">— {c.lieu}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!ing.is_external && ing.cueillettes.length === 0 && (
            <p className="text-[13px] text-gray-400 italic">Aucune cueillette enregistrée</p>
          )}

          {/* Plantations */}
          {!ing.is_external && ing.plantations.length > 0 && (
            <div>
              <h4 className="text-[13px] font-semibold text-gray-700 mb-2">
                Plantations ({ing.plantations.length})
              </h4>
              <div className="space-y-3">
                {ing.plantations.map(p => (
                  <div key={p.id} className="pl-2 border-l-2 border-green-200 space-y-1">
                    <div className="flex items-center gap-2 text-[13px] text-gray-700">
                      <span className="flex-shrink-0">🌱</span>
                      <span className="font-medium">{p.rang}</span>
                      {p.nb_plants != null && (
                        <span>— {p.nb_plants} plants {p.type_plant ?? ''}</span>
                      )}
                    </div>

                    {/* Lien semis */}
                    {p.seedling_numero && (
                      <div className="flex items-center gap-2 text-[12px] text-gray-500 pl-6">
                        <span>← Semis {p.seedling_numero}</span>
                        {p.seedling_date_semis && (
                          <span>({formatDate(p.seedling_date_semis)})</span>
                        )}
                      </div>
                    )}

                    {/* Lien sachet de graines */}
                    {p.seed_lot_interne && (
                      <div className="flex items-center gap-2 text-[12px] text-gray-500 pl-6">
                        <span>← Sachet {p.seed_lot_interne}</span>
                        {p.seed_fournisseur && <span>({p.seed_fournisseur})</span>}
                        {p.seed_certif_ab && <CertifAbBadge />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!ing.is_external && ing.plantations.length === 0 && (
            <p className="text-[13px] text-gray-400 italic">Aucune plantation enregistrée</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------
   Composant principal
--------------------------------------------------------------- */

type Props = {
  initialLots: LotSearchResult[]
}

export default function TracabiliteClient({ initialLots }: Props) {
  const [query, setQuery] = useState('')
  const [lots, setLots] = useState<LotSearchResult[]>(initialLots)
  const [trace, setTrace] = useState<LotTraceability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSearching, startSearch] = useTransition()
  const [isLoading, startLoad] = useTransition()

  const handleSearch = useCallback((q: string) => {
    setError(null)
    startSearch(async () => {
      try {
        const results = await searchProductionLots(q)
        setLots(results)
      } catch {
        setError('Erreur lors de la recherche')
      }
    })
  }, [])

  const handleSelectLot = useCallback((lotId: string) => {
    setError(null)
    startLoad(async () => {
      try {
        const data = await fetchLotTraceability(lotId)
        setTrace(data)
      } catch {
        setError('Erreur lors du chargement de la traçabilité')
      }
    })
  }, [])

  const handleBack = useCallback(() => {
    setTrace(null)
    setError(null)
  }, [])

  // ── Vue traçabilité (lot sélectionné) ──
  if (trace) {
    return <TraceView trace={trace} onBack={handleBack} />
  }

  // ── Vue recherche (état initial) ──
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9F8F6' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Traçabilité</h1>
        <p className="text-sm text-gray-500 mb-6">
          Rechercher un lot de production et remonter la chaîne complète
        </p>

        {/* Barre de recherche */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(query) }}
            placeholder="Numéro de lot ou nom de recette…"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
          />
          <button
            onClick={() => handleSearch(query)}
            disabled={isSearching}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary, #4A7C59)' }}
          >
            {isSearching ? '…' : 'Rechercher'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl">{error}</div>
        )}

        {/* Liste des lots */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">Chargement de la traçabilité…</div>
        )}

        {!isLoading && lots.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Aucun lot trouvé</div>
        )}

        {!isLoading && lots.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {lots.map(lot => (
              <button
                key={lot.id}
                onClick={() => handleSelectLot(lot.id)}
                className="w-full text-left px-5 py-3.5 hover:bg-[#F9F8F4] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {lot.numero_lot}
                  </span>
                  <span className="text-sm text-gray-600">— {lot.recipe_nom}</span>
                  {lot.category_nom && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {lot.category_nom}
                    </span>
                  )}
                  <span className="ml-auto text-sm text-gray-400">
                    {formatDate(lot.date_production)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------
   Vue traçabilité complète
--------------------------------------------------------------- */

function TraceView({
  trace,
  onBack,
}: {
  trace: LotTraceability
  onBack: () => void
}) {
  const { lot, ingredients } = trace
  const nbIngredients = ingredients.length
  const nbPlants = ingredients.filter(i => !i.is_external).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9F8F6' }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Retour */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <span>←</span> Retour
        </button>

        {/* Carte du lot */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Lot {lot.numero_lot}
              </h2>
              <p className="text-[15px] text-gray-600 mt-0.5">
                {lot.recipe_nom}
                {lot.category_nom && (
                  <span className="text-gray-400"> — {lot.category_nom}</span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-1.5">
                {lot.nb_unites && lot.recipe_poids_sachet_g
                  ? `${lot.nb_unites} sachets × ${lot.recipe_poids_sachet_g}g = ${formatPoids(lot.poids_total_g ?? 0)}`
                  : lot.poids_total_g
                  ? formatPoids(lot.poids_total_g)
                  : ''}
                {' — '}Produit le {formatDate(lot.date_production)}
              </p>
              {lot.ddm && (
                <p className="text-sm text-gray-400 mt-0.5">DDM : {formatDate(lot.ddm)}</p>
              )}
              {lot.temps_min ? (
                <p className="text-sm text-gray-400 mt-0.5">Temps : {formatTemps(lot.temps_min)}</p>
              ) : null}
              {lot.commentaire && (
                <p className="text-sm text-gray-400 mt-0.5 italic">{lot.commentaire}</p>
              )}
            </div>

            {/* Bouton export */}
            <button
              onClick={() => downloadTraceText(trace)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span>📥</span> Exporter
            </button>
          </div>
        </div>

        {/* Composition */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Composition ({nbIngredients} ingrédient{nbIngredients > 1 ? 's' : ''}{nbPlants < nbIngredients ? `, dont ${nbPlants} plante${nbPlants > 1 ? 's' : ''}` : ''})
          </h3>
        </div>

        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <IngredientAccordion
              key={ing.variety_id ?? ing.external_material_id ?? idx}
              ing={ing}
              defaultOpen={idx < 3}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

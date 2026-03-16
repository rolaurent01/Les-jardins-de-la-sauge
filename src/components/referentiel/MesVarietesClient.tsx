'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { VarietyWithSetting } from '@/app/[orgSlug]/(dashboard)/referentiel/mes-varietes/actions'
import {
  toggleVariety,
  bulkSetVarieties,
  updateSeuilAlerte,
  resetFarmSettings,
} from '@/app/[orgSlug]/(dashboard)/referentiel/mes-varietes/actions'
import { normalize } from '@/lib/utils/normalize'

const SANS_FAMILLE = 'Sans famille'

/** Regroupe les variétés par famille, "Sans famille" en dernier */
function groupByFamille(varieties: VarietyWithSetting[]): [string, VarietyWithSetting[]][] {
  const groups = new Map<string, VarietyWithSetting[]>()

  for (const v of varieties) {
    const key = v.famille ?? SANS_FAMILLE
    const list = groups.get(key)
    if (list) list.push(v)
    else groups.set(key, [v])
  }

  // Trier par nom de famille (alphabétique), "Sans famille" en dernier
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === SANS_FAMILLE) return 1
    if (b === SANS_FAMILLE) return -1
    return a.localeCompare(b, 'fr')
  })
}

type Props = {
  initialVarieties: VarietyWithSetting[]
  initialHasSettings: boolean
}

export default function MesVarietesClient({ initialVarieties, initialHasSettings }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // État local
  const [varieties, setVarieties] = useState(initialVarieties)
  const [hasSettings, setHasSettings] = useState(initialHasSettings)
  const [search, setSearch] = useState('')
  const [familleFilter, setFamilleFilter] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Mode onboarding = pas encore de settings
  const isOnboarding = !hasSettings

  // Sélection locale (pour mode onboarding et toggle individuel optimistic)
  const [selection, setSelection] = useState<Set<string>>(
    () => new Set(varieties.filter((v) => v.isSelected).map((v) => v.id)),
  )

  // Debounce timers pour seuil alerte
  const seuilTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Liste des familles uniques pour le filtre
  const allFamilles = [...new Set(varieties.map((v) => v.famille ?? SANS_FAMILLE))].sort(
    (a, b) => {
      if (a === SANS_FAMILLE) return 1
      if (b === SANS_FAMILLE) return -1
      return a.localeCompare(b, 'fr')
    },
  )

  // Filtrage par recherche + famille
  const filtered = varieties.filter((v) => {
    if (familleFilter && (v.famille ?? SANS_FAMILLE) !== familleFilter) return false
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(v.nom_vernaculaire).includes(q) ||
      (v.nom_latin && normalize(v.nom_latin).includes(q)) ||
      (v.famille && normalize(v.famille).includes(q))
    )
  })

  const grouped = groupByFamille(filtered)
  const selectedCount = selection.size
  const totalCount = varieties.length

  // Toggle une variété dans la sélection
  const handleToggle = useCallback(
    (varietyId: string) => {
      setSelection((prev) => {
        const next = new Set(prev)
        if (next.has(varietyId)) next.delete(varietyId)
        else next.add(varietyId)

        // En mode normal, persister immédiatement
        if (!isOnboarding) {
          const hidden = !next.has(varietyId)
          startTransition(async () => {
            await toggleVariety(varietyId, hidden)
          })
        }

        return next
      })
    },
    [isOnboarding],
  )

  // Sélectionner / désélectionner tout (variétés filtrées)
  function handleSelectAll(select: boolean) {
    setSelection((prev) => {
      const next = new Set(prev)
      for (const v of filtered) {
        if (select) next.add(v.id)
        else next.delete(v.id)
      }
      return next
    })
  }

  // Valider la sélection (mode onboarding)
  function handleValidateOnboarding() {
    startTransition(async () => {
      const result = await bulkSetVarieties([...selection])
      if ('error' in result) return
      setHasSettings(true)
      router.refresh()
    })
  }

  // Réinitialiser → repasser en mode onboarding
  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    setConfirmReset(false)
    startTransition(async () => {
      const result = await resetFarmSettings()
      if ('error' in result) return
      setHasSettings(false)
      // Toutes redeviennent visibles par défaut
      setSelection(new Set(varieties.map((v) => v.id)))
      router.refresh()
    })
  }

  // Seuil d'alerte — sauvegarde au blur
  function handleSeuilChange(varietyId: string, value: string) {
    // Annuler le timer précédent
    const existing = seuilTimers.current.get(varietyId)
    if (existing) clearTimeout(existing)

    const parsed = value.trim() === '' ? null : parseFloat(value)
    if (parsed !== null && isNaN(parsed)) return

    // Mettre à jour localement
    setVarieties((prev) =>
      prev.map((v) => (v.id === varietyId ? { ...v, seuil_alerte_g: parsed } : v)),
    )
  }

  function handleSeuilBlur(varietyId: string, value: string) {
    const parsed = value.trim() === '' ? null : parseFloat(value)
    if (parsed !== null && isNaN(parsed)) return

    startTransition(async () => {
      await updateSeuilAlerte(varietyId, parsed)
    })
  }

  return (
    <div className="p-8">
      {/* ---- En-tête ---- */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
          {isOnboarding ? 'Sélectionnez vos variétés' : 'Mes variétés'}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
          {isOnboarding
            ? 'Cochez les variétés que vous cultivez. Les autres seront masquées des formulaires et du mobile.'
            : `${selectedCount} variété${selectedCount !== 1 ? 's' : ''} sélectionnée${selectedCount !== 1 ? 's' : ''} sur ${totalCount}`}
        </p>
      </div>

      {/* ---- Barre de recherche ---- */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: '#9CA89D' }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher par nom, famille…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{
              backgroundColor: '#FAF5E9',
              borderColor: '#D8E0D9',
              color: '#2C3E2D',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) => (e.target.style.borderColor = '#D8E0D9')}
            aria-label="Rechercher"
          />
        </div>

        {/* Filtre par famille */}
        <select
          value={familleFilter ?? ''}
          onChange={(e) => setFamilleFilter(e.target.value || null)}
          className="px-3 py-2 text-sm rounded-lg border outline-none"
          style={{
            backgroundColor: '#FAF5E9',
            borderColor: '#D8E0D9',
            color: '#2C3E2D',
          }}
        >
          <option value="">Toutes les familles</option>
          {allFamilles.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        {/* Sélectionner tout / Tout désélectionner */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSelectAll(true)}
            className="px-3 py-2 text-xs rounded-lg border transition-colors"
            style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
          >
            Tout sélectionner
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            className="px-3 py-2 text-xs rounded-lg border transition-colors"
            style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
          >
            Tout désélectionner
          </button>
        </div>
      </div>

      {/* ---- Groupes par famille ---- */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🌿</div>
          <p className="text-sm">Aucune variété ne correspond à la recherche.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([famille, items]) => {
            const familleSelected = items.filter((v) => selection.has(v.id)).length
            return (
              <div key={famille}>
                {/* Titre famille + compteur */}
                <div
                  className="flex items-center gap-2 mb-2 pb-1"
                  style={{ borderBottom: '1px solid #D8E0D9' }}
                >
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: '#2C3E2D' }}
                  >
                    {famille}
                  </h2>
                  <span className="text-xs" style={{ color: '#9CA89D' }}>
                    ({familleSelected}/{items.length})
                  </span>
                </div>

                {/* Grille de variétés */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {items.map((v) => {
                    const checked = selection.has(v.id)
                    return (
                      <VarietyRow
                        key={v.id}
                        variety={v}
                        checked={checked}
                        showSeuil={!isOnboarding && checked}
                        onToggle={() => handleToggle(v.id)}
                        onSeuilChange={(val) => handleSeuilChange(v.id, val)}
                        onSeuilBlur={(val) => handleSeuilBlur(v.id, val)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- Barre de pied ---- */}
      <div
        className="mt-8 pt-4 flex items-center justify-between"
        style={{ borderTop: '1px solid #D8E0D9' }}
      >
        <p className="text-sm" style={{ color: '#6B7B6C' }}>
          {selectedCount} variété{selectedCount !== 1 ? 's' : ''} sélectionnée
          {selectedCount !== 1 ? 's' : ''} sur {totalCount}
        </p>

        <div className="flex items-center gap-3">
          {/* Bouton Réinitialiser (mode normal uniquement) */}
          {!isOnboarding && (
            <button
              onClick={handleReset}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm border transition-colors"
              style={{
                borderColor: confirmReset ? '#BC6C25' : '#D8E0D9',
                color: confirmReset ? '#BC6C25' : '#9CA89D',
              }}
            >
              {confirmReset ? 'Confirmer la réinitialisation' : 'Réinitialiser'}
            </button>
          )}

          {/* Bouton Valider (mode onboarding uniquement) */}
          {isOnboarding && (
            <button
              onClick={handleValidateOnboarding}
              disabled={isPending || selectedCount === 0}
              className="px-6 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
            >
              {isPending ? 'Enregistrement…' : 'Valider la sélection'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---- Sous-composant : ligne variété ---- */

type VarietyRowProps = {
  variety: VarietyWithSetting
  checked: boolean
  showSeuil: boolean
  onToggle: () => void
  onSeuilChange: (value: string) => void
  onSeuilBlur: (value: string) => void
}

function VarietyRow({
  variety,
  checked,
  showSeuil,
  onToggle,
  onSeuilChange,
  onSeuilBlur,
}: VarietyRowProps) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors"
      style={{
        backgroundColor: checked ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
      }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-4 h-4 rounded flex-shrink-0 accent-[var(--color-primary)]"
      />

      {/* Nom */}
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 text-left text-sm min-w-0"
      >
        <span style={{ color: '#2C3E2D' }}>{variety.nom_vernaculaire}</span>
        {variety.nom_latin && (
          <span className="ml-1.5 italic text-xs" style={{ color: '#9CA89D' }}>
            ({variety.nom_latin})
          </span>
        )}
      </button>

      {/* Seuil d'alerte (affiché uniquement en mode normal + variété sélectionnée) */}
      {showSeuil && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs" style={{ color: '#9CA89D' }}>
            Alerte &lt;
          </span>
          <input
            type="number"
            min="0"
            step="1"
            defaultValue={variety.seuil_alerte_g ?? ''}
            onChange={(e) => onSeuilChange(e.target.value)}
            onBlur={(e) => onSeuilBlur(e.target.value)}
            className="w-16 px-1.5 py-0.5 text-xs rounded border text-right outline-none"
            style={{
              backgroundColor: '#FAF5E9',
              borderColor: '#D8E0D9',
              color: '#2C3E2D',
            }}
            placeholder="—"
          />
          <span className="text-xs" style={{ color: '#9CA89D' }}>g</span>
        </div>
      )}
    </div>
  )
}

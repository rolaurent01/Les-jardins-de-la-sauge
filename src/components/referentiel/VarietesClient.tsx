'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Variety } from '@/lib/types'
import { archiveVariety, restoreVariety, createVariety, updateVariety } from '@/app/(dashboard)/referentiel/varietes/actions'
import VarieteSlideOver from './VarieteSlideOver'

/* Normalise une chaîne pour la recherche insensible casse + accents */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const TYPE_CYCLE_LABELS: Record<string, string> = {
  annuelle: 'Annuelle',
  bisannuelle: 'Bisannuelle',
  perenne: 'Pérenne',
  vivace: 'Vivace',
}

const TYPE_CYCLE_COLORS: Record<string, { bg: string; text: string }> = {
  annuelle:    { bg: '#FEF3C7', text: '#92400E' },
  bisannuelle: { bg: '#E0F2FE', text: '#075985' },
  perenne:     { bg: '#DCFCE7', text: '#166534' },
  vivace:      { bg: '#F3E8FF', text: '#7E22CE' },
}

export default function VarietesClient({ initialVarieties }: { initialVarieties: Variety[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [varieties, setVarieties] = useState(initialVarieties)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingVariety, setEditingVariety] = useState<Variety | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  /* Sync quand Next.js re-fetche après router.refresh() */
  useEffect(() => {
    setVarieties(initialVarieties)
  }, [initialVarieties])

  /* Reset la confirmation d'archivage si on clique ailleurs */
  useEffect(() => {
    if (!confirmArchiveId) return
    const timer = setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmArchiveId])

  const active   = varieties.filter(v => !v.deleted_at)
  const archived = varieties.filter(v => !!v.deleted_at)

  const displayed = (showArchived ? archived : active).filter(v => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(v.nom_vernaculaire).includes(q) ||
      (v.nom_latin  && normalize(v.nom_latin).includes(q))  ||
      (v.famille    && normalize(v.famille).includes(q))
    )
  })

  function openCreate() {
    setEditingVariety(null)
    setSlideOverOpen(true)
  }

  function openEdit(v: Variety) {
    setEditingVariety(v)
    setSlideOverOpen(true)
  }

  async function handleSave(formData: FormData) {
    if (editingVariety) {
      return updateVariety(editingVariety.id, formData)
    }
    return createVariety(formData)
  }

  function handleSaveSuccess() {
    setSlideOverOpen(false)
    router.refresh()
  }

  function handleArchiveClick(id: string) {
    if (confirmArchiveId === id) {
      setConfirmArchiveId(null)
      setPendingId(id)
      startTransition(async () => {
        await archiveVariety(id)
        setPendingId(null)
        router.refresh()
      })
    } else {
      setConfirmArchiveId(id)
    }
  }

  function handleRestore(id: string) {
    setPendingId(id)
    startTransition(async () => {
      await restoreVariety(id)
      setPendingId(null)
      router.refresh()
    })
  }

  return (
    <div className="p-8">
      {/* ---- En-tête ---- */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
            Variétés
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
            {active.length} variété{active.length !== 1 ? 's' : ''} actives
            {archived.length > 0 && (
              <> · {archived.length} archivée{archived.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ backgroundColor: '#3A5A40', color: '#F9F8F6' }}
        >
          <span className="text-base leading-none">＋</span>
          Nouvelle variété
        </button>
      </div>

      {/* ---- Barre de recherche + toggle archivées ---- */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
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
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
            style={{
              backgroundColor: '#FAF5E9',
              borderColor: '#D8E0D9',
              color: '#2C3E2D',
            }}
            onFocus={e  => (e.target.style.borderColor = '#3A5A40')}
            onBlur={e   => (e.target.style.borderColor = '#D8E0D9')}
          />
        </div>

        {archived.length > 0 && (
          <button
            onClick={() => setShowArchived(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors"
            style={{
              borderColor: showArchived ? '#3A5A40' : '#D8E0D9',
              backgroundColor: showArchived ? '#3A5A4012' : 'transparent',
              color: showArchived ? '#3A5A40' : '#9CA89D',
            }}
          >
            {showArchived ? '← Actives' : `Archivées (${archived.length})`}
          </button>
        )}
      </div>

      {/* ---- Tableau ---- */}
      {displayed.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border"
          style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
        >
          <div className="text-3xl mb-2">🌱</div>
          <p className="text-sm">
            {search
              ? 'Aucune variété ne correspond à la recherche.'
              : showArchived
              ? 'Aucune variété archivée.'
              : 'Aucune variété. Commencez par en créer une.'}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: '#D8E0D9' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                <Th>Nom vernaculaire</Th>
                <Th>Nom latin</Th>
                <Th>Famille</Th>
                <Th>Cycle</Th>
                <Th align="right">Péremption</Th>
                <Th align="right">Seuil alerte</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((v, i) => {
                const isArchived   = !!v.deleted_at
                const isPending    = pendingId === v.id
                const isConfirming = confirmArchiveId === v.id
                const cycleStyle   = v.type_cycle ? TYPE_CYCLE_COLORS[v.type_cycle] : null

                return (
                  <tr
                    key={v.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                      borderBottom: '1px solid #EDE8E0',
                      opacity: isArchived || isPending ? 0.5 : 1,
                    }}
                  >
                    {/* Nom vernaculaire */}
                    <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                      {v.nom_vernaculaire}
                      {v.notes && (
                        <span
                          className="ml-1.5 text-xs"
                          style={{ color: '#9CA89D' }}
                          title={v.notes}
                        >
                          💬
                        </span>
                      )}
                    </td>

                    {/* Nom latin */}
                    <td className="px-4 py-3 italic" style={{ color: '#6B7B6C' }}>
                      {v.nom_latin ?? <Dash />}
                    </td>

                    {/* Famille */}
                    <td className="px-4 py-3" style={{ color: '#6B7B6C' }}>
                      {v.famille ?? <Dash />}
                    </td>

                    {/* Cycle */}
                    <td className="px-4 py-3">
                      {v.type_cycle && cycleStyle ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: cycleStyle.bg, color: cycleStyle.text }}
                        >
                          {TYPE_CYCLE_LABELS[v.type_cycle]}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>

                    {/* Péremption */}
                    <td className="px-4 py-3 text-right" style={{ color: '#6B7B6C' }}>
                      {v.duree_peremption_mois} mois
                    </td>

                    {/* Seuil alerte */}
                    <td className="px-4 py-3 text-right">
                      {v.seuil_alerte_g != null ? (
                        <span style={{ color: '#DDA15E' }}>
                          🔔 {v.seuil_alerte_g} g
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isArchived ? (
                          <button
                            onClick={() => handleRestore(v.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                            style={{
                              borderColor: '#3A5A40',
                              color: '#3A5A40',
                            }}
                          >
                            Restaurer
                          </button>
                        ) : isConfirming ? (
                          <>
                            <button
                              onClick={() => handleArchiveClick(v.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                              style={{ backgroundColor: '#BC6C25', color: '#FFF' }}
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmArchiveId(null)}
                              className="px-2.5 py-1 rounded-lg text-xs border"
                              style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(v)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Modifier"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#3A5A40')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleArchiveClick(v.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              title="Archiver"
                              style={{ color: '#9CA89D' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#BC6C25')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                            >
                              🗄️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Slide-over ---- */}
      <VarieteSlideOver
        key={editingVariety?.id ?? 'new'}
        open={slideOverOpen}
        variety={editingVariety}
        onClose={() => setSlideOverOpen(false)}
        onSubmit={handleSave}
        onSuccess={handleSaveSuccess}
      />
    </div>
  )
}

/* ---- Sous-composants utilitaires ---- */
function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
      style={{
        color: '#9CA89D',
        textAlign: align,
      }}
    >
      {children}
    </th>
  )
}

function Dash() {
  return <span style={{ color: '#D8E0D9' }}>—</span>
}

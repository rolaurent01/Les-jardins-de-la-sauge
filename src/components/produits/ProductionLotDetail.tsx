'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ProductionLotWithRelations, ProductionMode, Conditionnement } from '@/lib/types'
import { formatDate, formatDuration } from '@/lib/utils/format'
import { MODE_LABELS } from './types'
import { fetchConditionnements, deleteConditionnement } from '@/app/[orgSlug]/(dashboard)/produits/production/actions'
import { useRouter } from 'next/navigation'

type Props = {
  lot: ProductionLotWithRelations | null
  open: boolean
  onClose: () => void
  onConditionner?: () => void
}

export default function ProductionLotDetail({ lot, open, onClose, onConditionner }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [conditionnements, setConditionnements] = useState<Conditionnement[]>([])
  const [loadingConds, setLoadingConds] = useState(false)
  const [confirmDeleteCondId, setConfirmDeleteCondId] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Charger les conditionnements quand on ouvre un lot melange
  useEffect(() => {
    if (open && lot && lot.mode === 'melange') {
      setLoadingConds(true)
      fetchConditionnements(lot.id)
        .then(setConditionnements)
        .catch(() => setConditionnements([]))
        .finally(() => setLoadingConds(false))
    } else {
      setConditionnements([])
    }
  }, [open, lot?.id, lot?.mode])

  useEffect(() => {
    if (!confirmDeleteCondId) return
    const timer = setTimeout(() => setConfirmDeleteCondId(null), 4000)
    return () => clearTimeout(timer)
  }, [confirmDeleteCondId])

  function handleDeleteCond(id: string) {
    if (confirmDeleteCondId === id) {
      setConfirmDeleteCondId(null)
      startTransition(async () => {
        await deleteConditionnement(id)
        // Recharger la liste
        if (lot) {
          const updated = await fetchConditionnements(lot.id)
          setConditionnements(updated)
        }
        router.refresh()
      })
    } else {
      setConfirmDeleteCondId(id)
    }
  }

  const isMelange = lot?.mode === 'melange'

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          backgroundColor: 'rgba(44, 62, 45, 0.35)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Panneau */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detail du lot"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FAF5E9',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* En-tete */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #D8E0D9' }}
        >
          <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
            Detail du lot
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#9CA89D' }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Contenu */}
        {lot && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Infos generales */}
            <div className="space-y-2.5">
              {lot.numero_lot && <InfoRow label="N° lot" value={lot.numero_lot} mono />}
              <InfoRow label="Recette" value={lot.recipes?.nom ?? '—'} />
              <InfoRow label="Mode" value={MODE_LABELS[lot.mode as ProductionMode] ?? lot.mode} />
              <InfoRow label="Date production" value={formatDate(lot.date_production)} />
              {!isMelange && <InfoRow label="DDM" value={formatDate(lot.ddm)} />}
              {!isMelange && (
                <InfoRow
                  label="Unites"
                  value={lot.nb_unites != null ? String(lot.nb_unites) : '—'}
                />
              )}
              <InfoRow
                label="Poids total"
                value={
                  lot.poids_total_g != null
                    ? lot.poids_total_g >= 1000
                      ? `${(lot.poids_total_g / 1000).toFixed(1)} kg`
                      : `${Math.round(lot.poids_total_g)} g`
                    : '—'
                }
              />
              <InfoRow label="Temps production" value={formatDuration(lot.temps_min)} />
              {lot.commentaire && <InfoRow label="Commentaire" value={lot.commentaire} />}
            </div>

            {/* Ingredients */}
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
                Ingredients ({lot.production_lot_ingredients.length})
              </h3>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                        Ingredient
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                        Etat
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                        %
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: '#9CA89D' }}>
                        Poids
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lot.production_lot_ingredients.map((ing, i) => (
                      <tr
                        key={ing.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                          borderBottom: '1px solid #EDE8E0',
                        }}
                      >
                        <td className="px-3 py-2" style={{ color: '#2C3E2D' }}>
                          {ing.varieties?.nom_vernaculaire ?? ing.external_materials?.nom ?? '—'}
                        </td>
                        <td className="px-3 py-2" style={{ color: '#6B7B6C' }}>
                          {ing.etat_plante ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: '#6B7B6C' }}>
                          {Math.round(ing.pourcentage * 1000) / 10}%
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: '#2C3E2D' }}>
                          {Math.round(ing.poids_g * 10) / 10} g
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section Conditionnements (mode melange uniquement) */}
            {isMelange && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
                    Mises en bouteille ({conditionnements.length})
                  </h3>
                  {onConditionner && (
                    <button
                      onClick={onConditionner}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
                    >
                      + Mise en bouteille
                    </button>
                  )}
                </div>

                {loadingConds ? (
                  <p className="text-xs py-4 text-center" style={{ color: '#9CA89D' }}>
                    Chargement…
                  </p>
                ) : conditionnements.length === 0 ? (
                  <div
                    className="text-center py-6 rounded-xl border"
                    style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
                  >
                    <p className="text-sm">Aucune mise en bouteille.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conditionnements.map(c => {
                      const isConfirming = confirmDeleteCondId === c.id

                      return (
                        <div
                          key={c.id}
                          className="rounded-lg border p-3"
                          style={{ borderColor: '#D8E0D9', backgroundColor: '#F9F8F6' }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-medium" style={{ color: '#2C3E2D' }}>
                                  {c.numero_lot}
                                </span>
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded text-xs"
                                  style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                                >
                                  {c.nb_unites} bouteille{c.nb_unites > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs" style={{ color: '#6B7B6C' }}>
                                <span>{formatDate(c.date_conditionnement)}</span>
                                {c.temps_min && <span>{formatDuration(c.temps_min)}</span>}
                                {c.ddm && <span>DDM: {formatDate(c.ddm)}</span>}
                              </div>
                              {c.commentaire && (
                                <p className="text-xs" style={{ color: '#9CA89D' }}>
                                  {c.commentaire}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isConfirming ? (
                                <>
                                  <button
                                    onClick={() => handleDeleteCond(c.id)}
                                    className="px-2 py-1 rounded text-xs font-medium"
                                    style={{ backgroundColor: '#DC2626', color: '#FFF' }}
                                  >
                                    Oui
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteCondId(null)}
                                    className="px-2 py-1 rounded text-xs border"
                                    style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
                                  >
                                    Non
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleDeleteCond(c.id)}
                                  className="p-1 rounded transition-colors"
                                  title="Supprimer"
                                  style={{ color: '#9CA89D' }}
                                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ---- Sous-composant ---- */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: '#6B7B6C' }}>{label}</span>
      <span
        className={mono ? 'font-mono' : ''}
        style={{ color: '#2C3E2D', fontWeight: 500 }}
      >
        {value}
      </span>
    </div>
  )
}

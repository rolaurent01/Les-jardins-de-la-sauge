'use client'

import { useState, useMemo } from 'react'
import {
  fetchAllVarieties,
  previewMerge,
  executeMerge,
} from '@/app/[orgSlug]/(dashboard)/admin/merge-varietes/actions'
import type {
  VarietyOption,
  MergePreview,
  MergeResult,
} from '@/app/[orgSlug]/(dashboard)/admin/merge-varietes/actions'

// ── Labels français pour les tables ──────────────────

const TABLE_LABELS: Record<string, string> = {
  seed_lots: 'Sachets de graines',
  seedlings: 'Semis',
  plantings: 'Plantations',
  row_care: 'Soins de rang',
  harvests: 'Cueillettes',
  uprootings: 'Arrachages',
  cuttings: 'Tronçonnages',
  dryings: 'Séchages',
  sortings: 'Tris',
  stock_movements: 'Mouvements de stock',
  stock_purchases: 'Achats',
  stock_direct_sales: 'Ventes directes',
  stock_adjustments: 'Ajustements de stock',
  recipe_ingredients: 'Ingrédients de recette',
  production_lot_ingredients: 'Ingrédients de lot',
  forecasts: 'Objectifs prévisionnels',
  farm_variety_settings: 'Paramètres par ferme',
}

type Props = {
  varieties: VarietyOption[]
}

export default function MergeVarietesClient({ varieties: initialVarieties }: Props) {
  const [varieties, setVarieties] = useState(initialVarieties)
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [sourceSearch, setSourceSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')

  // Étape : 'select' | 'preview' | 'result'
  const [step, setStep] = useState<'select' | 'preview' | 'result'>('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)

  const source = varieties.find(v => v.id === sourceId)
  const target = varieties.find(v => v.id === targetId)

  // Filtrage des listes
  const filteredSource = useMemo(() => {
    const q = sourceSearch.toLowerCase()
    return varieties
      .filter(v => v.id !== targetId)
      .filter(v =>
        !q ||
        v.nom_vernaculaire.toLowerCase().includes(q) ||
        (v.nom_latin?.toLowerCase().includes(q) ?? false),
      )
  }, [varieties, targetId, sourceSearch])

  const filteredTarget = useMemo(() => {
    const q = targetSearch.toLowerCase()
    return varieties
      .filter(v => v.id !== sourceId)
      .filter(v =>
        !q ||
        v.nom_vernaculaire.toLowerCase().includes(q) ||
        (v.nom_latin?.toLowerCase().includes(q) ?? false),
      )
  }, [varieties, sourceId, targetSearch])

  // ── Prévisualisation ─────────────────────────────────

  async function handlePreview() {
    if (!sourceId || !targetId) return
    setLoading(true)
    setError(null)
    try {
      const result = await previewMerge(sourceId, targetId)
      setPreview(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setLoading(false)
  }

  // ── Exécution ────────────────────────────────────────

  async function handleExecute() {
    if (!sourceId || !targetId) return
    setLoading(true)
    setError(null)
    try {
      const result = await executeMerge(sourceId, targetId)
      if ('error' in result) {
        setError(result.error)
        setLoading(false)
        return
      }
      setMergeResult(result.data ?? null)
      setStep('result')
      // Rafraîchir la liste
      const updated = await fetchAllVarieties()
      setVarieties(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setLoading(false)
  }

  // ── Reset ────────────────────────────────────────────

  function handleReset() {
    setSourceId('')
    setTargetId('')
    setSourceSearch('')
    setTargetSearch('')
    setStep('select')
    setPreview(null)
    setMergeResult(null)
    setError(null)
  }

  return (
    <div className="p-6" style={{ maxWidth: '900px' }}>
      <h1 className="text-lg font-semibold mb-1" style={{ color: '#1F2937' }}>
        Fusion de variétés
      </h1>
      <p className="text-xs mb-6" style={{ color: '#6B7280' }}>
        Fusionner un doublon vers une variété cible. Toutes les références seront mises à jour.
      </p>

      {error && (
        <div
          className="mb-4"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            fontSize: '13px',
            color: '#DC2626',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Étape 1 : Sélection ── */}
      {step === 'select' && (
        <Card>
          <div className="flex flex-col gap-5">
            {/* Source */}
            <div>
              <label htmlFor="admin-merge-source-search" className="block text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>
                Source (doublon à supprimer)
              </label>
              <input
                id="admin-merge-source-search"
                type="text"
                placeholder="Rechercher une variété..."
                value={sourceSearch}
                onChange={e => setSourceSearch(e.target.value)}
                style={inputStyle}
              />
              <select
                id="admin-merge-source-select"
                value={sourceId}
                onChange={e => setSourceId(e.target.value)}
                style={{ ...selectStyle, marginTop: '4px' }}
                size={5}
              >
                <option value="">— Sélectionner —</option>
                {filteredSource.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom_vernaculaire}{v.nom_latin ? ` (${v.nom_latin})` : ''}
                  </option>
                ))}
              </select>
              {source && (
                <VarietyDetail variety={source} />
              )}
            </div>

            {/* Cible */}
            <div>
              <label htmlFor="admin-merge-target-search" className="block text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>
                Cible (variété à conserver)
              </label>
              <input
                id="admin-merge-target-search"
                type="text"
                placeholder="Rechercher une variété..."
                value={targetSearch}
                onChange={e => setTargetSearch(e.target.value)}
                style={inputStyle}
              />
              <select
                id="admin-merge-target-select"
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                style={{ ...selectStyle, marginTop: '4px' }}
                size={5}
              >
                <option value="">— Sélectionner —</option>
                {filteredTarget.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom_vernaculaire}{v.nom_latin ? ` (${v.nom_latin})` : ''}
                  </option>
                ))}
              </select>
              {target && (
                <VarietyDetail variety={target} />
              )}
            </div>

            {/* Bouton */}
            <button
              onClick={handlePreview}
              disabled={!sourceId || !targetId || sourceId === targetId || loading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#2563EB',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: !sourceId || !targetId || sourceId === targetId ? 'default' : 'pointer',
                opacity: !sourceId || !targetId || sourceId === targetId ? 0.5 : 1,
                alignSelf: 'flex-start',
              }}
            >
              {loading ? 'Analyse en cours...' : 'Prévisualiser la fusion'}
            </button>

            {sourceId && targetId && sourceId === targetId && (
              <p className="text-xs" style={{ color: '#DC2626' }}>
                La source et la cible doivent être différentes.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ── Étape 2 : Prévisualisation ── */}
      {step === 'preview' && preview && source && target && (
        <Card>
          <h2 className="font-semibold text-sm mb-3" style={{ color: '#1F2937' }}>
            Fusion : {source.nom_vernaculaire} → {target.nom_vernaculaire}
          </h2>

          {preview.details.length === 0 ? (
            <p className="text-xs mb-4" style={{ color: '#6B7280' }}>
              Aucun enregistrement lié à la source. La variété sera simplement archivée.
            </p>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                Enregistrements qui seront mis à jour :
              </p>
              <div
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                      <th style={thStyle}>Table</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Nb enregistrements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.details.map(d => (
                      <tr key={d.table} style={{ borderTop: '1px solid #E5E7EB' }}>
                        <td style={tdStyle}>{TABLE_LABELS[d.table] ?? d.table}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm font-semibold mb-3" style={{ color: '#1F2937' }}>
                Total : {preview.total} enregistrement{preview.total > 1 ? 's' : ''} dans {preview.details.length} table{preview.details.length > 1 ? 's' : ''}
              </p>
            </>
          )}

          <div
            className="mb-4"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              fontSize: '12px',
              color: '#92400E',
            }}
          >
            Cette action est irréversible. &quot;{source.nom_vernaculaire}&quot; sera archivée et son nom ajouté aux alias de &quot;{target.nom_vernaculaire}&quot;.
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#fff',
                fontSize: '13px',
                color: '#6B7280',
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleExecute}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#DC2626',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Fusion en cours...' : 'Confirmer la fusion'}
            </button>
          </div>
        </Card>
      )}

      {/* ── Étape 3 : Résultat ── */}
      {step === 'result' && mergeResult && source && (
        <Card>
          <div
            className="mb-4"
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              fontSize: '13px',
              color: '#065F46',
              fontWeight: 600,
            }}
          >
            Fusion terminée
          </div>

          {mergeResult.tables_updated.length > 0 ? (
            <p className="text-sm mb-3" style={{ color: '#374151' }}>
              {mergeResult.tables_updated.reduce((s, t) => s + t.count, 0)} enregistrement{mergeResult.tables_updated.reduce((s, t) => s + t.count, 0) > 1 ? 's' : ''} mis à jour dans {mergeResult.tables_updated.length} table{mergeResult.tables_updated.length > 1 ? 's' : ''}.
            </p>
          ) : (
            <p className="text-sm mb-3" style={{ color: '#374151' }}>
              Aucun enregistrement à mettre à jour.
            </p>
          )}
          <p className="text-sm mb-4" style={{ color: '#374151' }}>
            &quot;{source.nom_vernaculaire}&quot; a été archivée.
          </p>

          <button
            onClick={handleReset}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              backgroundColor: '#2563EB',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Nouvelle fusion
          </button>
        </Card>
      )}
    </div>
  )
}

// ── Sous-composants ──────────────────────────────────

function VarietyDetail({ variety }: { variety: VarietyOption }) {
  return (
    <div className="mt-1 text-xs" style={{ color: '#6B7280' }}>
      {variety.nom_latin && <span>Latin : {variety.nom_latin}</span>}
      {variety.nom_latin && variety.famille && <span> · </span>}
      {variety.famille && <span>Famille : {variety.famille}</span>}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '20px',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        backgroundColor: '#fff',
      }}
    >
      {children}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  fontSize: '13px',
  width: '100%',
  maxWidth: '400px',
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  fontSize: '13px',
  width: '100%',
  maxWidth: '400px',
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '12px',
  color: '#6B7280',
  borderBottom: '1px solid #E5E7EB',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 12px',
  color: '#1F2937',
}

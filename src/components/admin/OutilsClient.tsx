'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  recalculateProductionSummary,
  impersonateFarm,
  stopImpersonation,
  fetchActivePlantings,
  closeSeasonForPlanting,
  autoCloseAnnuals,
} from '@/app/[orgSlug]/(dashboard)/admin/outils/actions'
import type {
  BackupLogEntry,
  OrgWithFarms,
  FarmOption,
  ActivePlanting,
} from '@/app/[orgSlug]/(dashboard)/admin/outils/actions'

type Props = {
  orgSlug: string
  backups: BackupLogEntry[]
  orgsWithFarms: OrgWithFarms[]
  impersonation: { farmId: string; farmName: string } | null
  farms: FarmOption[]
}

export default function OutilsClient({
  orgSlug,
  backups,
  orgsWithFarms,
  impersonation,
  farms,
}: Props) {
  return (
    <div className="p-6" style={{ maxWidth: '900px' }}>
      <h1 className="text-lg font-semibold mb-6" style={{ color: '#1F2937' }}>
        Outils d&#39;administration
      </h1>

      <div className="flex flex-col gap-6">
        <RecalculSection />
        <BackupSection backups={backups} />
        <ImpersonationSection
          orgSlug={orgSlug}
          orgsWithFarms={orgsWithFarms}
          impersonation={impersonation}
        />
        <SeasonCloseSection farms={farms} />
      </div>
    </div>
  )
}

// ── Section 1 — Recalcul production_summary ─────────

function RecalculSection() {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleRecalculate() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setConfirm(false)
    setLoading(true)
    setResult(null)

    const res = await recalculateProductionSummary()
    setLoading(false)

    if ('error' in res) {
      setResult(`Erreur : ${res.error}`)
    } else {
      setResult(res.data?.message ?? 'Recalcul terminé.')
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-sm mb-2" style={{ color: '#1F2937' }}>
        Recalcul production_summary
      </h2>
      <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
        Reconstruit entièrement la table production_summary depuis les données sources.
        À utiliser si les cumuls semblent incorrects.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={handleRecalculate}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: confirm ? '#DC2626' : '#2563EB',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Recalcul en cours...' : confirm ? 'Confirmer le recalcul' : 'Recalculer maintenant'}
        </button>
        {confirm && !loading && (
          <button
            onClick={() => setConfirm(false)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              backgroundColor: '#fff',
              fontSize: '13px',
              color: '#6B7280',
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        )}
      </div>
      {result && (
        <p className="mt-2 text-xs" style={{ color: result.startsWith('Erreur') ? '#DC2626' : '#059669' }}>
          {result}
        </p>
      )}
    </Card>
  )
}

// ── Section 2 — État des backups ────────────────────

function BackupSection({ backups }: { backups: BackupLogEntry[] }) {
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState<string | null>(null)

  async function handleTriggerBackup() {
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const res = await fetch('/api/backup', { method: 'POST' })
      if (res.ok) {
        setTriggerResult('Backup lancé avec succès.')
      } else {
        const body = await res.text()
        setTriggerResult(`Erreur : ${body}`)
      }
    } catch (err) {
      setTriggerResult(`Erreur : ${err instanceof Error ? err.message : String(err)}`)
    }
    setTriggerLoading(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card>
      <h2 className="font-semibold text-sm mb-2" style={{ color: '#1F2937' }}>
        Backups quotidiens
      </h2>

      {backups.length === 0 ? (
        <p className="text-xs" style={{ color: '#9CA3AF' }}>Aucun backup trouvé dans les logs.</p>
      ) : (
        <div className="flex flex-col gap-1 mb-3">
          {backups.map(b => (
            <div key={b.id} className="flex items-center gap-2 text-xs">
              <span>{b.level === 'error' ? '❌' : '✅'}</span>
              <span style={{ color: '#6B7280' }}>{formatDate(b.created_at)}</span>
              <span style={{ color: '#374151' }}>— {b.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleTriggerBackup}
          disabled={triggerLoading}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#374151',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: triggerLoading ? 'wait' : 'pointer',
            opacity: triggerLoading ? 0.6 : 1,
          }}
        >
          {triggerLoading ? 'Lancement...' : 'Lancer un backup maintenant'}
        </button>
      </div>
      {triggerResult && (
        <p className="mt-2 text-xs" style={{ color: triggerResult.startsWith('Erreur') ? '#DC2626' : '#059669' }}>
          {triggerResult}
        </p>
      )}
    </Card>
  )
}

// ── Section 3 — Impersonation ───────────────────────

function ImpersonationSection({
  orgSlug,
  orgsWithFarms,
  impersonation,
}: {
  orgSlug: string
  orgsWithFarms: OrgWithFarms[]
  impersonation: { farmId: string; farmName: string } | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedOrg, setSelectedOrg] = useState('')
  const [selectedFarm, setSelectedFarm] = useState('')

  const currentOrg = orgsWithFarms.find(o => o.id === selectedOrg)
  const availableFarms = currentOrg?.farms ?? []

  async function handleImpersonate() {
    if (!selectedFarm) return
    const result = await impersonateFarm(selectedFarm)
    if ('success' in result && result.data) {
      startTransition(() => {
        router.push(`/${result.data!.orgSlug}/dashboard`)
      })
    }
  }

  async function handleStopImpersonation() {
    await stopImpersonation()
    startTransition(() => {
      router.push(`/${orgSlug}/admin/outils`)
      router.refresh()
    })
  }

  return (
    <Card>
      <h2 className="font-semibold text-sm mb-2" style={{ color: '#1F2937' }}>
        Impersonation
      </h2>
      <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
        Se connecter &quot;en tant que&quot; une ferme pour voir exactement ce que le client voit.
      </p>

      {impersonation && (
        <div
          className="mb-3 flex items-center gap-3"
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
          }}
        >
          <span style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600 }}>
            Impersonation active : {impersonation.farmName}
          </span>
          <button
            onClick={handleStopImpersonation}
            disabled={isPending}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              backgroundColor: '#DC2626',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Arrêter
          </button>
        </div>
      )}

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#6B7280' }}>Organisation</label>
          <select
            value={selectedOrg}
            onChange={e => {
              setSelectedOrg(e.target.value)
              setSelectedFarm('')
            }}
            style={selectStyle}
          >
            <option value="">Choisir...</option>
            {orgsWithFarms.map(o => (
              <option key={o.id} value={o.id}>{o.nom}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#6B7280' }}>Ferme</label>
          <select
            value={selectedFarm}
            onChange={e => setSelectedFarm(e.target.value)}
            disabled={!selectedOrg}
            style={{ ...selectStyle, opacity: selectedOrg ? 1 : 0.5 }}
          >
            <option value="">Choisir...</option>
            {availableFarms.map(f => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleImpersonate}
          disabled={!selectedFarm || isPending}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#7C3AED',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: !selectedFarm ? 'default' : 'pointer',
            opacity: !selectedFarm ? 0.5 : 1,
          }}
        >
          Impersonner cette ferme
        </button>
      </div>
    </Card>
  )
}

// ── Section 4 — Clôture de saison ───────────────────

function SeasonCloseSection({ farms }: { farms: FarmOption[] }) {
  const [selectedFarm, setSelectedFarm] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [plantings, setPlantings] = useState<ActivePlanting[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [actions, setActions] = useState<Record<string, 'keep' | 'uproot'>>({})
  const [closing, setClosing] = useState(false)
  const [closeResult, setCloseResult] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  async function handleLoadPlantings() {
    if (!selectedFarm) return
    setLoading(true)
    setPlantings(null)
    setCloseResult(null)
    try {
      const data = await fetchActivePlantings(selectedFarm, selectedYear)
      setPlantings(data)
      // Défaut : garder les vivaces, arracher les annuelles
      const defaultActions: Record<string, 'keep' | 'uproot'> = {}
      for (const p of data) {
        defaultActions[p.id] = p.type_cycle === 'annuelle' ? 'uproot' : 'keep'
      }
      setActions(defaultActions)
    } catch (err) {
      setCloseResult(`Erreur : ${err instanceof Error ? err.message : String(err)}`)
    }
    setLoading(false)
  }

  async function handleAutoCloseAnnuals() {
    if (!selectedFarm) return
    setClosing(true)
    const result = await autoCloseAnnuals(selectedFarm, selectedYear)
    setClosing(false)
    if ('error' in result) {
      setCloseResult(`Erreur : ${result.error}`)
    } else {
      setCloseResult(`${result.data?.count ?? 0} annuelles arrachées automatiquement.`)
      handleLoadPlantings()
    }
  }

  async function handleConfirmClose() {
    if (!plantings) return
    setClosing(true)
    setCloseResult(null)

    let kept = 0
    let uprooted = 0

    for (const p of plantings) {
      const action = actions[p.id] ?? 'keep'
      const result = await closeSeasonForPlanting(p.id, action, selectedYear)
      if ('success' in result) {
        if (action === 'keep') kept++
        else uprooted++
      }
    }

    setClosing(false)
    setCloseResult(`Clôture terminée : ${kept} gardés, ${uprooted} arrachés.`)
    setPlantings(null)
  }

  // Badge type_cycle
  function CycleBadge({ type }: { type: string | null }) {
    const isAnnual = type === 'annuelle'
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: isAnnual ? '#FEF3C7' : '#D1FAE5',
          color: isAnnual ? '#D97706' : '#059669',
        }}
      >
        {type ?? 'inconnu'}
      </span>
    )
  }

  return (
    <Card>
      <h2 className="font-semibold text-sm mb-2" style={{ color: '#1F2937' }}>
        Clôture de saison
      </h2>
      <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
        Clôturer l&#39;année pour une ferme : confirmer les plantings actifs, arracher les annuelles restantes.
      </p>

      <div className="flex gap-3 items-end flex-wrap mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#6B7280' }}>Ferme</label>
          <select
            value={selectedFarm}
            onChange={e => {
              setSelectedFarm(e.target.value)
              setPlantings(null)
              setCloseResult(null)
            }}
            style={selectStyle}
          >
            <option value="">Choisir...</option>
            {farms.map(f => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#6B7280' }}>Année</label>
          <select
            value={selectedYear}
            onChange={e => {
              setSelectedYear(parseInt(e.target.value))
              setPlantings(null)
              setCloseResult(null)
            }}
            style={selectStyle}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleLoadPlantings}
          disabled={!selectedFarm || loading}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#374151',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: !selectedFarm ? 'default' : 'pointer',
            opacity: !selectedFarm ? 0.5 : 1,
          }}
        >
          {loading ? 'Chargement...' : 'Lancer la clôture'}
        </button>
      </div>

      {closeResult && (
        <p className="mb-3 text-xs" style={{ color: closeResult.startsWith('Erreur') ? '#DC2626' : '#059669' }}>
          {closeResult}
        </p>
      )}

      {plantings && plantings.length === 0 && (
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          Aucun planting actif trouvé pour cette ferme et cette année.
        </p>
      )}

      {plantings && plantings.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleAutoCloseAnnuals}
              disabled={closing}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#D97706',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Arracher toutes les annuelles
            </button>
            <span className="text-xs" style={{ color: '#6B7280' }}>
              {plantings.length} planting{plantings.length > 1 ? 's' : ''} actif{plantings.length > 1 ? 's' : ''}
            </span>
          </div>

          <div
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              overflow: 'hidden',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  <th style={thStyle}>Parcelle</th>
                  <th style={thStyle}>Rang</th>
                  <th style={thStyle}>Variété</th>
                  <th style={thStyle}>Cycle</th>
                  <th style={thStyle}>Date plantation</th>
                  <th style={{ ...thStyle, width: '140px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {plantings.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                    <td style={tdStyle}>{p.parcel_nom}</td>
                    <td style={tdStyle}>{p.row_numero}</td>
                    <td style={tdStyle}>{p.variety_name}</td>
                    <td style={tdStyle}><CycleBadge type={p.type_cycle} /></td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>
                        {new Date(p.date_plantation).toLocaleDateString('fr-FR')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setActions(prev => ({ ...prev, [p.id]: 'keep' }))}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: '1px solid',
                            cursor: 'pointer',
                            ...(actions[p.id] === 'keep'
                              ? { backgroundColor: '#D1FAE5', borderColor: '#059669', color: '#059669' }
                              : { backgroundColor: '#fff', borderColor: '#D1D5DB', color: '#9CA3AF' }),
                          }}
                        >
                          Garder
                        </button>
                        <button
                          onClick={() => setActions(prev => ({ ...prev, [p.id]: 'uproot' }))}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: '1px solid',
                            cursor: 'pointer',
                            ...(actions[p.id] === 'uproot'
                              ? { backgroundColor: '#FEF3C7', borderColor: '#D97706', color: '#D97706' }
                              : { backgroundColor: '#fff', borderColor: '#D1D5DB', color: '#9CA3AF' }),
                          }}
                        >
                          Arracher
                        </button>
                      </div>
                      {p.type_cycle === 'annuelle' && actions[p.id] !== 'uproot' && (
                        <span className="block mt-1 text-xs" style={{ color: '#D97706' }}>
                          ⚠️ Annuelle encore active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleConfirmClose}
              disabled={closing}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: '#DC2626',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: closing ? 'wait' : 'pointer',
                opacity: closing ? 0.6 : 1,
              }}
            >
              {closing ? 'Clôture en cours...' : 'Confirmer la clôture'}
            </button>
            <span className="text-xs" style={{ color: '#6B7280' }}>
              {Object.values(actions).filter(a => a === 'keep').length} gardés,{' '}
              {Object.values(actions).filter(a => a === 'uproot').length} arrachés
            </span>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Composants utilitaires ──────────────────────────

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

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  fontSize: '13px',
  minWidth: '160px',
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

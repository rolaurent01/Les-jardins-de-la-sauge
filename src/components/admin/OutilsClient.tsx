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
  fetchSuperData,
  fetchArchivedCounts,
  purgeArchives,
  purgeAllArchives,
} from '@/app/[orgSlug]/(dashboard)/admin/outils/actions'
import type {
  BackupLogEntry,
  OrgWithFarms,
  FarmOption,
  ActivePlanting,
  SuperDataResult,
  ArchivedCount,
} from '@/app/[orgSlug]/(dashboard)/admin/outils/actions'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
        <SuperDataSection />
        <PurgeArchivesSection />
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
          <label htmlFor="admin-outils-impers-org" className="text-xs" style={{ color: '#6B7280' }}>Organisation</label>
          <select
            id="admin-outils-impers-org"
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
          <label htmlFor="admin-outils-impers-ferme" className="text-xs" style={{ color: '#6B7280' }}>Ferme</label>
          <select
            id="admin-outils-impers-ferme"
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
          <label htmlFor="admin-outils-cloture-ferme" className="text-xs" style={{ color: '#6B7280' }}>Ferme</label>
          <select
            id="admin-outils-cloture-ferme"
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
          <label htmlFor="admin-outils-cloture-annee" className="text-xs" style={{ color: '#6B7280' }}>Année</label>
          <select
            id="admin-outils-cloture-annee"
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

// ── Section 5 — Super data cross-tenant ─────────────

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function SuperDataSection() {
  const [data, setData] = useState<SuperDataResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function handleLoad() {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchSuperData()
      setData(result)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setLoading(false)
  }

  // Chargement au premier affichage
  if (!loaded && !loading) {
    handleLoad()
  }

  const totalStock = data?.stockParEtat.reduce((s, e) => s + e.total_kg, 0) ?? 0

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm" style={{ color: '#1F2937' }}>
          Super data (plateforme)
        </h2>
        <button
          onClick={handleLoad}
          disabled={loading}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid #D1D5DB',
            backgroundColor: '#fff',
            fontSize: '12px',
            color: '#374151',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Chargement...' : 'Rafraîchir'}
        </button>
      </div>

      {error && (
        <p className="text-xs mb-3" style={{ color: '#DC2626' }}>Erreur : {error}</p>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          {/* Stock total */}
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#1F2937' }}>
              Stock total : {totalStock.toFixed(2)} kg
            </p>
            <div className="flex gap-3 flex-wrap">
              {data.stockParEtat.map(s => (
                <span key={s.etat} className="text-xs" style={{ color: '#6B7280' }}>
                  {s.etat} : {s.total_kg.toFixed(2)} kg
                </span>
              ))}
            </div>
          </div>

          {/* Activité par org */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>
              Activité ce mois
            </p>
            {data.activiteParOrg.map(a => (
              <div key={a.org_nom} className="text-xs mb-1" style={{ color: '#374151' }}>
                <span className="font-semibold">{a.org_nom}</span> : {a.nb_cueillettes} cueillette{a.nb_cueillettes > 1 ? 's' : ''}, {a.nb_lots} lot{a.nb_lots > 1 ? 's' : ''}, {a.nb_users} utilisateur{a.nb_users > 1 ? 's' : ''}
              </div>
            ))}
          </div>

          {/* Top variétés */}
          {data.topVarietes.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>
                Top variétés (nb fermes qui les cultivent)
              </p>
              {data.topVarietes.map((v, i) => (
                <div key={v.nom_vernaculaire} className="text-xs" style={{ color: '#374151' }}>
                  {i + 1}. {v.nom_vernaculaire} ({v.nb_fermes} ferme{v.nb_fermes > 1 ? 's' : ''})
                </div>
              ))}
            </div>
          )}

          {/* Graphique volume mensuel */}
          {data.volumeParMois.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#6B7280' }}>
                Volume cueilli par mois ({new Date().getFullYear()})
              </p>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={data.volumeParMois.map(v => ({ ...v, label: MOIS_LABELS[v.mois - 1] ?? v.mois }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(2)} kg`, 'Volume']}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="total_kg" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Section 6 — Purge des archives ──────────────────

const TABLE_LABELS_PURGE: Record<string, string> = {
  varieties: 'Variétés',
  seed_lots: 'Sachets de graines',
  seedlings: 'Semis',
  plantings: 'Plantations',
  harvests: 'Cueillettes',
  recipes: 'Recettes',
  production_lots: 'Lots de production',
  stock_movements: 'Mouvements de stock',
}

function PurgeArchivesSection() {
  const [counts, setCounts] = useState<ArchivedCount[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [olderThanDays, setOlderThanDays] = useState(30)
  const [purging, setPurging] = useState<string | null>(null)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)

  // Confirmation renforcée pour "Tout purger"
  const [purgeAllConfirm, setPurgeAllConfirm] = useState(false)
  const [purgeAllText, setPurgeAllText] = useState('')
  const [purgingAll, setPurgingAll] = useState(false)

  // Confirmation simple par table
  const [confirmTable, setConfirmTable] = useState<string | null>(null)

  async function loadCounts(days?: number) {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchArchivedCounts(undefined, days ?? olderThanDays)
      setCounts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setLoading(false)
  }

  // Chargement initial
  if (!counts && !loading && !error) {
    loadCounts()
  }

  async function handlePurgeTable(table: string) {
    if (confirmTable !== table) {
      setConfirmTable(table)
      return
    }
    setConfirmTable(null)
    setPurging(table)
    setPurgeResult(null)
    try {
      const res = await purgeArchives(table, undefined, olderThanDays)
      if ('error' in res) {
        setPurgeResult(`Erreur : ${res.error}`)
      } else {
        setPurgeResult(`${res.data?.deleted ?? 0} enregistrement(s) purgé(s) de ${TABLE_LABELS_PURGE[table] ?? table}.`)
        await loadCounts()
      }
    } catch (err) {
      setPurgeResult(`Erreur : ${err instanceof Error ? err.message : String(err)}`)
    }
    setPurging(null)
  }

  async function handlePurgeAll() {
    if (!purgeAllConfirm) {
      setPurgeAllConfirm(true)
      return
    }
    if (purgeAllText !== 'PURGER') return

    setPurgingAll(true)
    setPurgeResult(null)
    try {
      const res = await purgeAllArchives(undefined, olderThanDays)
      if ('error' in res) {
        setPurgeResult(`Erreur : ${res.error}`)
      } else {
        setPurgeResult(`Purge terminée : ${res.data?.total ?? 0} enregistrement(s) supprimé(s).`)
        await loadCounts()
      }
    } catch (err) {
      setPurgeResult(`Erreur : ${err instanceof Error ? err.message : String(err)}`)
    }
    setPurgingAll(false)
    setPurgeAllConfirm(false)
    setPurgeAllText('')
  }

  const total = counts?.reduce((s, c) => s + c.count, 0) ?? 0

  return (
    <Card>
      <h2 className="font-semibold text-sm mb-2" style={{ color: '#1F2937' }}>
        Purge des archives
      </h2>
      <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
        Supprimer définitivement les éléments archivés (suppression logique).
      </p>

      {error && (
        <p className="text-xs mb-3" style={{ color: '#DC2626' }}>Erreur : {error}</p>
      )}

      {loading && !counts && (
        <p className="text-xs" style={{ color: '#9CA3AF' }}>Chargement...</p>
      )}

      {counts && (
        <>
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
                  <th style={{ ...thStyle, textAlign: 'right' }}>Nb archivés</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {counts.map(c => (
                  <tr key={c.table} style={{ borderTop: '1px solid #E5E7EB' }}>
                    <td style={tdStyle}>{c.label}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{c.count}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {c.count > 0 ? (
                        <button
                          onClick={() => handlePurgeTable(c.table)}
                          disabled={purging === c.table}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            backgroundColor: confirmTable === c.table ? '#DC2626' : '#F3F4F6',
                            color: confirmTable === c.table ? '#fff' : '#374151',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: purging === c.table ? 'wait' : 'pointer',
                          }}
                        >
                          {purging === c.table
                            ? 'Purge...'
                            : confirmTable === c.table
                              ? 'Confirmer'
                              : 'Purger'}
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm font-semibold mb-3" style={{ color: '#1F2937' }}>
            Total : {total} élément{total > 1 ? 's' : ''} archivé{total > 1 ? 's' : ''}
          </p>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs" style={{ color: '#6B7280' }}>
              Purger uniquement les archives de plus de
            </span>
            <input
              type="number"
              min={1}
              value={olderThanDays}
              onChange={e => {
                const days = parseInt(e.target.value) || 30
                setOlderThanDays(days)
                loadCounts(days)
              }}
              style={{
                width: '60px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                textAlign: 'center',
              }}
            />
            <span className="text-xs" style={{ color: '#6B7280' }}>jours</span>
          </div>

          {total > 0 && (
            <div className="flex flex-col gap-2">
              {!purgeAllConfirm ? (
                <button
                  onClick={handlePurgeAll}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#DC2626',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  Tout purger
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs" style={{ color: '#DC2626', fontWeight: 600 }}>
                    Tapez PURGER pour confirmer :
                  </span>
                  <input
                    type="text"
                    value={purgeAllText}
                    onChange={e => setPurgeAllText(e.target.value)}
                    placeholder="PURGER"
                    style={{
                      width: '100px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #FECACA',
                      fontSize: '13px',
                    }}
                  />
                  <button
                    onClick={handlePurgeAll}
                    disabled={purgeAllText !== 'PURGER' || purgingAll}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      backgroundColor: purgeAllText === 'PURGER' ? '#DC2626' : '#9CA3AF',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: purgeAllText === 'PURGER' ? 'pointer' : 'default',
                    }}
                  >
                    {purgingAll ? 'Purge en cours...' : 'Confirmer la purge totale'}
                  </button>
                  <button
                    onClick={() => { setPurgeAllConfirm(false); setPurgeAllText('') }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: '#fff',
                      fontSize: '12px',
                      color: '#6B7280',
                      cursor: 'pointer',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          )}

          <div
            className="mt-3"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              fontSize: '11px',
              color: '#92400E',
            }}
          >
            La purge est définitive. Les éléments ne pourront pas être restaurés.
          </div>

          {purgeResult && (
            <p className="mt-2 text-xs" style={{ color: purgeResult.startsWith('Erreur') ? '#DC2626' : '#059669' }}>
              {purgeResult}
            </p>
          )}
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

'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { SeedlingWithRelations, Variety, ActionResult, Processus, Seedling } from '@/lib/types'
import {
  computeSeedlingLossRate,
  type MiniMotteLossStats,
  type CaissetteGodetLossStats,
} from '@/lib/utils/seedling-stats'
import QuickAddVariety from '@/components/varieties/QuickAddVariety'
import type { SeedLotForSelect } from './SemisClient'

type Props = {
  open:      boolean
  seedling:  SeedlingWithRelations | null  // null = création
  seedLots:  SeedLotForSelect[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]
  onClose:   () => void
  onSubmit:  (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function SemisSlideOver({
  open,
  seedling,
  seedLots,
  varieties: initialVarieties,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const firstFieldRef                = useRef<HTMLSelectElement>(null)

  /* Liste locale des variétés — s'enrichit si on crée via QuickAddVariety */
  const [varieties, setVarieties]           = useState(initialVarieties)
  const [selectedVarietyId, setVarietyId]   = useState(seedling?.variety_id ?? '')
  const [selectedSeedLotId, setSeedLotId]   = useState(seedling?.seed_lot_id ?? '')

  /* Processus — conditionne les champs affichés */
  const [processus, setProcessus] = useState<Processus>(seedling?.processus ?? 'mini_motte')

  /* Champs pour le récapitulatif de perte en temps réel */
  const [nbMottes,       setNbMottes]       = useState<number | null>(seedling?.nb_mottes ?? null)
  const [nbMortesMottes, setNbMortesMottes] = useState(seedling?.nb_mortes_mottes ?? 0)
  const [nbPlantsC,      setNbPlantsC]      = useState<number | null>(seedling?.nb_plants_caissette ?? null)
  const [nbMortesC,      setNbMortesC]      = useState(seedling?.nb_mortes_caissette ?? 0)
  const [nbGodets,       setNbGodets]       = useState<number | null>(seedling?.nb_godets ?? null)
  const [nbMortesG,      setNbMortesG]      = useState(seedling?.nb_mortes_godet ?? 0)
  const [nbDonnees,      setNbDonnees]      = useState(seedling?.nb_donnees ?? 0)
  const [nbObtenus,      setNbObtenus]      = useState<number | null>(seedling?.nb_plants_obtenus ?? null)

  /* Resync si les variétés initiales changent */
  useEffect(() => {
    setVarieties(initialVarieties)
  }, [initialVarieties])

  /* Resync complet quand on change de semis (via key prop du parent) */
  useEffect(() => {
    setVarietyId(seedling?.variety_id ?? '')
    setSeedLotId(seedling?.seed_lot_id ?? '')
    setProcessus(seedling?.processus ?? 'mini_motte')
    setNbMottes(seedling?.nb_mottes ?? null)
    setNbMortesMottes(seedling?.nb_mortes_mottes ?? 0)
    setNbPlantsC(seedling?.nb_plants_caissette ?? null)
    setNbMortesC(seedling?.nb_mortes_caissette ?? 0)
    setNbGodets(seedling?.nb_godets ?? null)
    setNbMortesG(seedling?.nb_mortes_godet ?? 0)
    setNbDonnees(seedling?.nb_donnees ?? 0)
    setNbObtenus(seedling?.nb_plants_obtenus ?? null)
    setError(null)
  }, [seedling])

  /* Focus le premier champ à l'ouverture */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  /* Fermeture au clavier Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  /** Appelé quand une variété est créée via QuickAddVariety */
  function handleVarietyCreated(variety: Variety) {
    setVarieties(prev => {
      if (prev.some(v => v.id === variety.id)) return prev
      return [
        ...prev,
        { id: variety.id, nom_vernaculaire: variety.nom_vernaculaire, nom_latin: variety.nom_latin },
      ].sort((a, b) => a.nom_vernaculaire.localeCompare(b.nom_vernaculaire, 'fr'))
    })
    setVarietyId(variety.id)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    // Synchroniser les champs contrôlés dans le FormData
    fd.set('variety_id', selectedVarietyId)
    fd.set('processus', processus)
    fd.set('seed_lot_id', selectedSeedLotId) // '' devient null dans parseSeedlingForm

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  /* Objet Seedling virtuel pour le calcul de perte en temps réel */
  const previewSeedling: Seedling = {
    id: '',               uuid_client: null,    seed_lot_id: null,
    variety_id: null,     processus,
    numero_caisse: null,
    nb_mottes: nbMottes,              nb_mortes_mottes: nbMortesMottes,
    nb_caissettes: null,
    nb_plants_caissette: nbPlantsC,   nb_mortes_caissette: nbMortesC,
    nb_godets: nbGodets,              nb_mortes_godet: nbMortesG,
    nb_donnees: nbDonnees,            nb_plants_obtenus: nbObtenus,
    date_semis: '',       poids_graines_utilise_g: null,
    date_levee: null,     date_repiquage: null,
    temps_semis_min: null, temps_repiquage_min: null,
    commentaire: null,    deleted_at: null,     created_at: '',
  }

  /* Récapitulatif visible uniquement si nb_plants_obtenus est renseigné */
  const showSummary = nbObtenus != null
  const lossStats   = showSummary ? computeSeedlingLossRate(previewSeedling) : null

  const isEdit = seedling !== null

  return (
    <>
      {/* ---- Overlay ---- */}
      <div
        onClick={() => !isPending && onClose()}
        style={{
          position:        'fixed', inset: 0, zIndex: 40,
          backgroundColor: 'rgba(44, 62, 45, 0.35)',
          backdropFilter:  'blur(2px)',
          opacity:         open ? 1 : 0,
          pointerEvents:   open ? 'auto' : 'none',
          transition:      'opacity 0.25s ease',
        }}
      />

      {/* ---- Panneau ---- */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Modifier le semis' : 'Nouveau semis'}
        style={{
          position:        'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width:           '100%', maxWidth: '520px',
          backgroundColor: '#FAF5E9',
          boxShadow:       '-4px 0 24px rgba(0,0,0,0.12)',
          display:         'flex', flexDirection: 'column',
          transform:       open ? 'translateX(0)' : 'translateX(100%)',
          transition:      'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* En-tête */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #D8E0D9' }}
        >
          <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
            {isEdit ? 'Modifier le semis' : 'Nouveau semis'}
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#9CA89D' }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-6 py-5 space-y-5 flex-1">

            {/* ===== Sélecteur de processus ===== */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
                Processus <span style={{ color: '#BC6C25' }}>*</span>
              </label>
              <div
                className="flex rounded-lg overflow-hidden border"
                style={{ borderColor: '#D8E0D9' }}
              >
                <ProcessBtn
                  active={processus === 'mini_motte'}
                  onClick={() => setProcessus('mini_motte')}
                  disabled={isPending}
                >
                  🌿 Mini-mottes
                </ProcessBtn>
                <ProcessBtn
                  active={processus === 'caissette_godet'}
                  onClick={() => setProcessus('caissette_godet')}
                  disabled={isPending}
                >
                  🥬 Caissette/Godet
                </ProcessBtn>
              </div>
            </div>

            {/* ===== Variété ===== */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: '#2C3E2D' }}>
                  Variété <span style={{ color: '#BC6C25' }}>*</span>
                </label>
                <QuickAddVariety
                  existingVarieties={varieties as Variety[]}
                  onCreated={handleVarietyCreated}
                />
              </div>
              <select
                ref={firstFieldRef}
                name="variety_id"
                required
                value={selectedVarietyId}
                onChange={e => setVarietyId(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Sélectionner une variété</option>
                {varieties.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.nom_vernaculaire}
                    {v.nom_latin ? ` — ${v.nom_latin}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* ===== Sachet source ===== */}
            <Field label="Sachet source">
              <select
                name="seed_lot_id"
                value={selectedSeedLotId}
                onChange={e => setSeedLotId(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">Aucun</option>
                {seedLots.map(sl => (
                  <option key={sl.id} value={sl.id}>
                    {sl.lot_interne}
                    {sl.varieties?.nom_vernaculaire ? ` — ${sl.varieties.nom_vernaculaire}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {/* ===== Date semis + Poids graines ===== */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date de semis" required>
                <input
                  name="date_semis"
                  type="date"
                  required
                  defaultValue={seedling?.date_semis ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
              <Field label="Poids graines (g)">
                <input
                  name="poids_graines_utilise_g"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={seedling?.poids_graines_utilise_g ?? ''}
                  disabled={isPending}
                  placeholder="ex : 1.5"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* ===== Date de levée ===== */}
            <Field label="Date de levée">
              <input
                name="date_levee"
                type="date"
                defaultValue={seedling?.date_levee ?? ''}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* ===== Champs spécifiques Mini-motte ===== */}
            {processus === 'mini_motte' && (
              <>
                <Separator label="Mini-mottes" />

                <Field label="N° de caisse">
                  <input
                    name="numero_caisse"
                    type="text"
                    defaultValue={seedling?.numero_caisse ?? ''}
                    disabled={isPending}
                    placeholder="ex : A"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nombre de mottes" required>
                    <input
                      name="nb_mottes"
                      type="number"
                      min="1"
                      required
                      value={nbMottes ?? ''}
                      onChange={e => setNbMottes(e.target.value ? parseInt(e.target.value, 10) : null)}
                      disabled={isPending}
                      placeholder="ex : 98"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                  <Field label="Mortes avant plantation">
                    <input
                      name="nb_mortes_mottes"
                      type="number"
                      min="0"
                      value={nbMortesMottes}
                      onChange={e => setNbMortesMottes(e.target.value ? parseInt(e.target.value, 10) : 0)}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                </div>
              </>
            )}

            {/* ===== Champs spécifiques Caissette/Godet ===== */}
            {processus === 'caissette_godet' && (
              <>
                <Separator label="Caissette/Godet" />

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nombre de caissettes" required>
                    <input
                      name="nb_caissettes"
                      type="number"
                      min="1"
                      required
                      defaultValue={seedling?.nb_caissettes ?? ''}
                      disabled={isPending}
                      placeholder="ex : 5"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                  <Field label="Plants en caissette" required>
                    <input
                      name="nb_plants_caissette"
                      type="number"
                      min="1"
                      required
                      value={nbPlantsC ?? ''}
                      onChange={e => setNbPlantsC(e.target.value ? parseInt(e.target.value, 10) : null)}
                      disabled={isPending}
                      placeholder="ex : 50"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Mortes en caissette">
                    <input
                      name="nb_mortes_caissette"
                      type="number"
                      min="0"
                      value={nbMortesC}
                      onChange={e => setNbMortesC(e.target.value ? parseInt(e.target.value, 10) : 0)}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                  <Field label="Date de repiquage">
                    <input
                      name="date_repiquage"
                      type="date"
                      defaultValue={seedling?.date_repiquage ?? ''}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nombre de godets">
                    <input
                      name="nb_godets"
                      type="number"
                      min="0"
                      value={nbGodets ?? ''}
                      onChange={e => setNbGodets(e.target.value ? parseInt(e.target.value, 10) : null)}
                      disabled={isPending}
                      placeholder="ex : 45"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                  <Field label="Mortes en godet">
                    <input
                      name="nb_mortes_godet"
                      type="number"
                      min="0"
                      value={nbMortesG}
                      onChange={e => setNbMortesG(e.target.value ? parseInt(e.target.value, 10) : 0)}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                </div>
              </>
            )}

            {/* ===== Champs communs fin ===== */}
            <Separator label="Résultats" />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Plants donnés">
                <input
                  name="nb_donnees"
                  type="number"
                  min="0"
                  value={nbDonnees}
                  onChange={e => setNbDonnees(e.target.value ? parseInt(e.target.value, 10) : 0)}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
              <Field label="Plants obtenus (plantés)">
                <input
                  name="nb_plants_obtenus"
                  type="number"
                  min="0"
                  value={nbObtenus ?? ''}
                  onChange={e => setNbObtenus(e.target.value ? parseInt(e.target.value, 10) : null)}
                  disabled={isPending}
                  placeholder="ex : 75"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Temps semis (min)">
                <input
                  name="temps_semis_min"
                  type="number"
                  min="0"
                  defaultValue={seedling?.temps_semis_min ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
              <Field label="Temps repiquage (min)">
                <input
                  name="temps_repiquage_min"
                  type="number"
                  min="0"
                  defaultValue={seedling?.temps_repiquage_min ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            <Field label="Commentaire">
              <textarea
                name="commentaire"
                rows={3}
                defaultValue={seedling?.commentaire ?? ''}
                disabled={isPending}
                placeholder="Observations, conditions de semis…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* ===== Récapitulatif de perte ===== */}
            {showSummary && lossStats && (
              <LossSummary processus={processus} stats={lossStats} />
            )}

            {/* Erreur */}
            {error && (
              <div
                className="text-sm px-3 py-2.5 rounded-lg"
                style={{
                  backgroundColor: '#FDF3E8',
                  color:           '#BC6C25',
                  border:          '1px solid #DDA15E44',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Pied : boutons */}
          <div
            className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0"
            style={{ borderTop: '1px solid #D8E0D9' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: '#3A5A40',
                color:           '#F9F8F6',
                opacity:         isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? isEdit ? 'Enregistrement…' : 'Création…'
                : isEdit ? 'Enregistrer'      : 'Créer le semis'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ---- Sous-composant : récapitulatif de perte ---- */

function LossSummary({
  processus,
  stats,
}: {
  processus: Processus
  stats: MiniMotteLossStats | CaissetteGodetLossStats
}) {
  if (processus === 'mini_motte' && 'perte_pct' in stats) {
    return <MiniMotteSummary stats={stats} />
  }
  if (processus === 'caissette_godet' && 'perte_globale_pct' in stats) {
    return <CaissetteSummary stats={stats} />
  }
  return null
}

function MiniMotteSummary({ stats }: { stats: MiniMotteLossStats }) {
  const pct = stats.perte_pct
  const { bg, color } = perteColors(pct)
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: bg, color }}>
      <p className="font-semibold mb-1">Récapitulatif</p>
      <p>
        {stats.total_depart} mottes → {stats.plantes} plantés
        {` (${stats.mortes} mortes`}
        {stats.donnees > 0 ? ` + ${stats.donnees} donnés` : ''}
        {')'}
        {pct != null ? ` = ${Math.round(pct)}% de perte` : ''}
      </p>
    </div>
  )
}

function CaissetteSummary({ stats }: { stats: CaissetteGodetLossStats }) {
  const pct = stats.perte_globale_pct
  const { bg, color } = perteColors(pct)
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: bg, color }}>
      <p className="font-semibold mb-1">Récapitulatif</p>
      <p>
        {stats.total_depart} caissette → {stats.plantes} plantés
        {` (${stats.mortes_caissette} mortes caissette`}
        {stats.mortes_godet > 0 ? ` + ${stats.mortes_godet} mortes godet` : ''}
        {stats.donnees > 0      ? ` + ${stats.donnees} donnés` : ''}
        {')'}
        {pct != null ? ` = ${Math.round(pct)}% de perte` : ''}
      </p>
    </div>
  )
}

/** Couleurs selon le taux de perte (vert < 20%, orange 20-40%, rouge > 40%) */
function perteColors(pct: number | null): { bg: string; color: string } {
  if (pct == null) return { bg: '#F5F2ED', color: '#9CA89D' }
  if (pct < 20)   return { bg: '#DCFCE7', color: '#166534' }
  if (pct < 40)   return { bg: '#FEF3C7', color: '#92400E' }
  return           { bg: '#FEE2E2', color: '#991B1B' }
}

/* ---- Sous-composants utilitaires ---- */

function ProcessBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active:    boolean
  onClick:   () => void
  disabled:  boolean
  children:  React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? '#3A5A40' : 'transparent',
        color:           active ? '#F9F8F6' : '#9CA89D',
      }}
    >
      {children}
    </button>
  )
}

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA89D' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: '#D8E0D9' }} />
    </div>
  )
}

/* ---- Helpers de style ---- */

const inputStyle: React.CSSProperties = {
  width:           '100%',
  padding:         '8px 12px',
  fontSize:        '14px',
  borderRadius:    '8px',
  border:          '1px solid #D8E0D9',
  backgroundColor: '#F9F8F6',
  color:           '#2C3E2D',
  outline:         'none',
}

function focusStyle(e: React.FocusEvent<HTMLElement>) {
  ;(e.target as HTMLElement).style.borderColor = '#3A5A40'
}
function blurStyle(e: React.FocusEvent<HTMLElement>) {
  ;(e.target as HTMLElement).style.borderColor = '#D8E0D9'
}

function Field({
  label,
  required,
  children,
}: {
  label:     string
  required?: boolean
  children:  React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#2C3E2D' }}>
        {label}
        {required && <span style={{ color: '#BC6C25' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

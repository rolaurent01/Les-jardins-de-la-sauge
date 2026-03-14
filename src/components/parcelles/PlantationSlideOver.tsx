'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { PlantingWithRelations, RowWithParcel, Variety, ActionResult, SeedlingStatut } from '@/lib/types'
import { SEEDLING_STATUT_LABELS } from '@/lib/types'
import type { SeedlingForSelect, RowWarnings } from '@/app/[orgSlug]/(dashboard)/parcelles/plantations/actions'
import { fetchRowWarnings } from '@/app/[orgSlug]/(dashboard)/parcelles/plantations/actions'
import QuickAddVariety from '@/components/varieties/QuickAddVariety'
import { formatDate } from '@/lib/utils/format'

type Props = {
  open: boolean
  planting: PlantingWithRelations | null
  rows: RowWithParcel[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'>[]
  seedlings: SeedlingForSelect[]
  certifBio?: boolean
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

const TYPE_PLANT_OPTIONS: { value: string; label: string }[] = [
  { value: 'godet', label: 'Godet' },
  { value: 'caissette', label: 'Caissette' },
  { value: 'mini_motte', label: 'Mini-motte' },
  { value: 'plant_achete', label: 'Plant acheté' },
  { value: 'division', label: 'Division' },
  { value: 'bouture', label: 'Bouture' },
  { value: 'marcottage', label: 'Marcottage' },
  { value: 'stolon', label: 'Stolon' },
  { value: 'rhizome', label: 'Rhizome' },
  { value: 'semis_direct', label: 'Semis direct' },
]

/** Groupe les rangs par "Site — Parcelle" pour les optgroups */
function groupRowsByParcel(rows: RowWithParcel[]): Map<string, { label: string; rows: RowWithParcel[] }> {
  const groups = new Map<string, { label: string; rows: RowWithParcel[] }>()

  for (const row of rows) {
    const parcel = row.parcels as { id?: string; nom?: string; code?: string; sites?: { nom?: string } | null } | null
    const siteName = parcel?.sites?.nom ?? ''
    const parcelName = parcel?.nom ?? ''
    const parcelCode = parcel?.code ?? ''
    const groupKey = `${siteName}__${parcelName}`
    const groupLabel = siteName
      ? `${siteName} — ${parcelName} (${parcelCode})`
      : `${parcelName} (${parcelCode})`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { label: groupLabel, rows: [] })
    }
    groups.get(groupKey)!.rows.push(row)
  }

  return groups
}

export default function PlantationSlideOver({
  open,
  planting,
  rows,
  varieties: initialVarieties,
  seedlings,
  certifBio = false,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const isEdit = planting !== null

  // ---- State du formulaire ----
  const [varieties, setVarieties] = useState(initialVarieties)
  const [selectedRowId, setSelectedRowId] = useState(planting?.row_id ?? '')
  const [selectedVarietyId, setSelectedVarietyId] = useState(planting?.variety_id ?? '')
  const [selectedSeedlingId, setSelectedSeedlingId] = useState(planting?.seedling_id ?? '')
  const [originMode, setOriginMode] = useState<'semis' | 'fournisseur'>(
    planting?.seedling_id ? 'semis' : 'fournisseur',
  )
  const [longueurM, setLongueurM] = useState<string>(planting?.longueur_m?.toString() ?? '')
  const [largeurM, setLargeurM] = useState<string>(planting?.largeur_m?.toString() ?? '')

  // ---- Avertissements rang ----
  const [warnings, setWarnings] = useState<RowWarnings | null>(null)
  const [loadingWarnings, setLoadingWarnings] = useState(false)

  // Resync variétés initiales
  useEffect(() => {
    setVarieties(initialVarieties)
  }, [initialVarieties])

  // Resync à l'ouverture/changement de planting
  useEffect(() => {
    setSelectedRowId(planting?.row_id ?? '')
    setSelectedVarietyId(planting?.variety_id ?? '')
    setSelectedSeedlingId(planting?.seedling_id ?? '')
    setOriginMode(planting?.seedling_id ? 'semis' : 'fournisseur')
    setLongueurM(planting?.longueur_m?.toString() ?? '')
    setLargeurM(planting?.largeur_m?.toString() ?? '')
    setError(null)
    setWarnings(null)
  }, [planting])

  // Focus premier champ
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  // Fermeture Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  // Charger avertissements quand le rang change
  useEffect(() => {
    if (!selectedRowId) {
      setWarnings(null)
      return
    }

    // En mode édition, charger aussi les avertissements pour le rang actuel
    setLoadingWarnings(true)
    fetchRowWarnings(selectedRowId)
      .then(setWarnings)
      .catch(() => setWarnings(null))
      .finally(() => setLoadingWarnings(false))
  }, [selectedRowId])

  // Pré-remplir les dimensions depuis le rang sélectionné (création uniquement)
  function handleRowChange(rowId: string) {
    setSelectedRowId(rowId)

    if (!isEdit && rowId) {
      const row = rows.find(r => r.id === rowId)
      if (row) {
        if (row.longueur_m != null) setLongueurM(row.longueur_m.toString())
        if ((row as RowWithParcel & { largeur_m?: number | null }).largeur_m != null) {
          setLargeurM(((row as RowWithParcel & { largeur_m?: number | null }).largeur_m as number).toString())
        }
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('row_id', selectedRowId)
    fd.set('variety_id', selectedVarietyId)
    fd.set('longueur_m', longueurM)
    fd.set('largeur_m', largeurM)

    // Nettoyer les champs de l'origine non sélectionnée
    if (originMode === 'semis') {
      fd.delete('fournisseur')
      fd.set('seedling_id', selectedSeedlingId)
    } else {
      fd.delete('seedling_id')
    }

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const rowGroups = groupRowsByParcel(rows)

  // Calcul avertissement dépassement en temps réel
  const longueurInput = parseFloat(longueurM) || 0
  const rowLongueur = warnings?.rowLongueur ?? null
  const totalUsed = warnings?.totalLongueurUsed ?? 0
  // En édition, exclure la longueur de la plantation en cours du total utilisé
  const editingLongueur = isEdit ? (planting?.longueur_m ?? 0) : 0
  const adjustedUsed = totalUsed - editingLongueur
  const remaining = rowLongueur != null ? rowLongueur - adjustedUsed : null
  const isOverflow = remaining != null && longueurInput > 0 && (adjustedUsed + longueurInput) > (rowLongueur ?? 0)

  return (
    <>
      {/* ---- Overlay ---- */}
      <div
        onClick={() => !isPending && onClose()}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          backgroundColor: 'rgba(44, 62, 45, 0.35)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* ---- Panneau ---- */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Modifier la plantation' : 'Nouvelle plantation'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: '500px',
          backgroundColor: '#FAF5E9',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* En-tête */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #D8E0D9' }}
        >
          <h2 className="text-base font-semibold" style={{ color: '#2C3E2D' }}>
            {isEdit ? 'Modifier la plantation' : 'Nouvelle plantation'}
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

            {/* Rang */}
            <Field label="Rang" required>
              <select
                ref={firstFieldRef}
                name="row_id"
                required
                value={selectedRowId}
                onChange={e => handleRowChange(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                <option value="">— Sélectionner un rang</option>
                {Array.from(rowGroups.entries()).map(([groupKey, group]) => (
                  <optgroup key={groupKey} label={group.label}>
                    {group.rows.map(row => (
                      <option key={row.id} value={row.id}>
                        Rang {row.numero}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {/* ---- Avertissements ---- */}
            {loadingWarnings && selectedRowId && (
              <div className="text-xs" style={{ color: '#9CA89D' }}>Chargement des informations du rang…</div>
            )}

            {warnings && !loadingWarnings && (
              <div className="space-y-2">
                {/* Rang déjà planté */}
                {warnings.activePlantings.length > 0 && (
                  <WarningBanner color="yellow">
                    ⚠️ Ce rang a déjà {warnings.activePlantings.length} plantation{warnings.activePlantings.length > 1 ? 's' : ''} active{warnings.activePlantings.length > 1 ? 's' : ''} :{' '}
                    {warnings.activePlantings.map((ap, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        {ap.variety_name} ({formatDate(ap.date_plantation)})
                      </span>
                    ))}
                  </WarningBanner>
                )}

                {/* Dépassement longueur */}
                {isOverflow && rowLongueur != null && (
                  <WarningBanner color="yellow">
                    ⚠️ Ce rang fait {rowLongueur}m, les plantations actives occupent {adjustedUsed.toFixed(1)}m.
                    Il reste {(remaining ?? 0).toFixed(1)}m disponibles.
                  </WarningBanner>
                )}

                {/* Occultation active */}
                {warnings.activeOccultation && (
                  <WarningBanner color="orange">
                    ⚠️ Ce rang est en occultation ({warnings.activeOccultation.methode}) depuis le{' '}
                    {formatDate(warnings.activeOccultation.date_debut)}.
                  </WarningBanner>
                )}
              </div>
            )}

            {/* Variété */}
            <Field label="Variété" required>
              <div className="flex items-center gap-2">
                <select
                  name="variety_id"
                  required
                  value={selectedVarietyId}
                  onChange={e => { setSelectedVarietyId(e.target.value); setSelectedSeedlingId('') }}
                  disabled={isPending}
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                >
                  <option value="">— Sélectionner une variété</option>
                  {varieties.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nom_vernaculaire}
                    </option>
                  ))}
                </select>
                <QuickAddVariety
                  existingVarieties={varieties as unknown as Variety[]}
                  onCreated={(newV) => {
                    setVarieties(prev => [...prev, { id: newV.id, nom_vernaculaire: newV.nom_vernaculaire }])
                    setSelectedVarietyId(newV.id)
                  }}
                />
              </div>
            </Field>

            {/* Origine */}
            <Field label="Origine">
              <div className="flex gap-2 mb-2">
                <ToggleBtn
                  active={originMode === 'semis'}
                  onClick={() => setOriginMode('semis')}
                  disabled={isPending}
                >
                  Issu de mes semis
                </ToggleBtn>
                <ToggleBtn
                  active={originMode === 'fournisseur'}
                  onClick={() => setOriginMode('fournisseur')}
                  disabled={isPending}
                >
                  Plant acheté
                </ToggleBtn>
              </div>

              {originMode === 'semis' ? (
                <>
                  <select
                    name="seedling_id"
                    value={selectedSeedlingId}
                    onChange={e => setSelectedSeedlingId(e.target.value)}
                    disabled={isPending}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  >
                    <option value="">— Semis d&apos;origine (optionnel)</option>
                    {seedlings
                      .filter(s => !selectedVarietyId || s.variety_id === selectedVarietyId)
                      .map(s => {
                        const isExhausted = s.plants_restants === 0
                        const stockLabel = s.plants_restants != null
                          ? `${s.plants_restants} dispo / ${s.nb_plants_obtenus ?? 0}`
                          : `${s.nb_plants_obtenus ?? '?'} obtenus`
                        const processLabel = s.processus === 'mini_motte' ? 'MM' : 'CG'
                        const dateLabel = s.date_semis ? formatDate(s.date_semis) : '?'
                        return (
                          <option
                            key={s.id}
                            value={s.id}
                            disabled={isExhausted && s.id !== planting?.seedling_id}
                          >
                            {processLabel} — {dateLabel}
                            {s.numero_caisse ? ` [${s.numero_caisse}]` : ''}
                            {' — '}
                            {stockLabel}
                            {isExhausted ? ' (épuisé)' : ''}
                          </option>
                        )
                      })
                    }
                  </select>

                  {/* Fiche récap du semis sélectionné */}
                  <SeedlingInfoCard
                    seedling={seedlings.find(s => s.id === selectedSeedlingId) ?? null}
                  />
                </>
              ) : (
                <input
                  name="fournisseur"
                  type="text"
                  defaultValue={planting?.fournisseur ?? ''}
                  disabled={isPending}
                  placeholder="Nom du fournisseur"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              )}
            </Field>

            {/* Grille 2 colonnes */}
            <div className="grid grid-cols-2 gap-4">
              {/* Année */}
              <Field label="Année" required>
                <input
                  name="annee"
                  type="number"
                  required
                  min="2020"
                  max="2099"
                  defaultValue={planting?.annee ?? new Date().getFullYear()}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              {/* Date plantation */}
              <Field label="Date plantation" required>
                <input
                  name="date_plantation"
                  type="date"
                  required
                  defaultValue={planting?.date_plantation ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Lune */}
              <Field label="Lune">
                <select
                  name="lune"
                  defaultValue={planting?.lune ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                >
                  <option value="">— Non renseigné</option>
                  <option value="montante">Montante</option>
                  <option value="descendante">Descendante</option>
                </select>
              </Field>

              {/* Nb plants */}
              <Field label="Nb plants">
                <input
                  name="nb_plants"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={planting?.nb_plants ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Type plant */}
              <Field label="Type de plant">
                <select
                  name="type_plant"
                  defaultValue={planting?.type_plant ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                >
                  <option value="">— Non renseigné</option>
                  {TYPE_PLANT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Espacement */}
              <Field label="Espacement (cm)">
                <input
                  name="espacement_cm"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={planting?.espacement_cm ?? ''}
                  disabled={isPending}
                  placeholder="cm"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Longueur */}
              <Field label="Longueur (m)">
                <input
                  name="longueur_m"
                  type="number"
                  min="0"
                  step="0.1"
                  value={longueurM}
                  onChange={e => setLongueurM(e.target.value)}
                  disabled={isPending}
                  placeholder="m"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              {/* Largeur */}
              <Field label="Largeur (m)">
                <input
                  name="largeur_m"
                  type="number"
                  min="0"
                  step="0.1"
                  value={largeurM}
                  onChange={e => setLargeurM(e.target.value)}
                  disabled={isPending}
                  placeholder="m"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Certif AB */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  name="certif_ab"
                  type="checkbox"
                  defaultChecked={planting?.certif_ab ?? certifBio}
                  disabled={isPending}
                  id="certif_ab"
                  className="rounded"
                />
                <label htmlFor="certif_ab" className="text-sm" style={{ color: '#2C3E2D' }}>
                  Certifié Agriculture Biologique
                </label>
              </div>
              {!planting && certifBio && (
                <p className="text-xs mt-1" style={{ color: '#9CA89D' }}>
                  Pré-coché (ferme bio)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Date commande */}
              <Field label="Date commande">
                <input
                  name="date_commande"
                  type="date"
                  defaultValue={planting?.date_commande ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>

              {/* N° facture */}
              <Field label="N° facture">
                <input
                  name="numero_facture"
                  type="text"
                  defaultValue={planting?.numero_facture ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Temps */}
            <Field label="Temps (min)">
              <input
                name="temps_min"
                type="number"
                min="1"
                step="1"
                defaultValue={planting?.temps_min ?? ''}
                disabled={isPending}
                placeholder="en minutes"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Commentaire */}
            <Field label="Commentaire">
              <textarea
                name="commentaire"
                rows={3}
                defaultValue={planting?.commentaire ?? ''}
                disabled={isPending}
                placeholder="Observations…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Erreur */}
            {error && (
              <div
                className="text-sm px-3 py-2.5 rounded-lg"
                style={{
                  backgroundColor: '#FDF3E8',
                  color: '#BC6C25',
                  border: '1px solid #DDA15E44',
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
                backgroundColor: 'var(--color-primary)',
                color: '#F9F8F6',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending
                ? isEdit ? 'Enregistrement…' : 'Création…'
                : isEdit ? 'Enregistrer' : 'Créer la plantation'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ---- Helpers de style ---- */
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  borderRadius: '8px',
  border: '1px solid #D8E0D9',
  backgroundColor: '#F9F8F6',
  color: '#2C3E2D',
  outline: 'none',
}

function focusStyle(e: React.FocusEvent<HTMLElement>) {
  ;(e.target as HTMLElement).style.borderColor = 'var(--color-primary)'
}
function blurStyle(e: React.FocusEvent<HTMLElement>) {
  ;(e.target as HTMLElement).style.borderColor = '#D8E0D9'
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
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

/** Bouton toggle pour le choix d'origine */
function ToggleBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#F9F8F6' : '#6B7B6C',
        border: active ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
      }}
    >
      {children}
    </button>
  )
}

/** Fiche récapitulative du semis sélectionné */
function SeedlingInfoCard({ seedling }: { seedling: SeedlingForSelect | null }) {
  if (!seedling) return null

  const statut = seedling.statut as SeedlingStatut | undefined
  const statutLabel = statut ? SEEDLING_STATUT_LABELS[statut] : null
  const statutColors = statut ? STATUT_CHIP_COLORS[statut] : null

  return (
    <div
      className="mt-2 rounded-lg px-3 py-2.5 text-xs space-y-1"
      style={{ backgroundColor: '#F5F2ED', border: '1px solid #E8E3DB' }}
    >
      <div className="flex items-center justify-between">
        <span style={{ color: '#6B7B6C' }}>
          {seedling.processus === 'mini_motte' ? 'Mini-motte' : 'Caissette/Godet'}
          {' · Semé le '}
          {seedling.date_semis ? formatDate(seedling.date_semis) : '?'}
        </span>
        {statutLabel && statutColors && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: statutColors.bg, color: statutColors.color }}
          >
            {statutLabel}
          </span>
        )}
      </div>

      {seedling.seed_lots && (
        <div style={{ color: '#9CA89D' }}>
          Sachet : {seedling.seed_lots.lot_interne}
          {seedling.seed_lots.fournisseur ? ` — ${seedling.seed_lots.fournisseur}` : ''}
        </div>
      )}

      {/* Jauge de stock */}
      {seedling.nb_plants_obtenus != null && seedling.plants_restants != null && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-0.5">
            <span style={{ color: '#6B7B6C' }}>
              {seedling.plants_plantes} planté{seedling.plants_plantes !== 1 ? 's' : ''}
              {' · '}
              <strong>{seedling.plants_restants}</strong> disponible{seedling.plants_restants !== 1 ? 's' : ''}
            </span>
            <span style={{ color: '#9CA89D' }}>
              / {seedling.nb_plants_obtenus}
            </span>
          </div>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 4, backgroundColor: '#D8E0D9' }}
          >
            <div
              className="rounded-full"
              style={{
                height: '100%',
                width: `${Math.min(100, (seedling.plants_plantes / seedling.nb_plants_obtenus) * 100)}%`,
                backgroundColor: seedling.plants_restants === 0 ? '#9CA89D' : 'var(--color-primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const STATUT_CHIP_COLORS: Record<SeedlingStatut, { bg: string; color: string }> = {
  semis:          { bg: '#F5F2ED', color: '#6B7B6C' },
  leve:           { bg: '#DCFCE7', color: '#166534' },
  repiquage:      { bg: '#DBEAFE', color: '#1E40AF' },
  pret:           { bg: '#D1FAE5', color: '#065F46' },
  en_plantation:  { bg: '#FEF3C7', color: '#92400E' },
  epuise:         { bg: '#F5F2ED', color: '#9CA89D' },
}

/** Bandeau d'avertissement */
function WarningBanner({ color, children }: { color: 'yellow' | 'orange'; children: React.ReactNode }) {
  const styles = {
    yellow: { bg: '#FEF3C7', border: '#F59E0B44', text: '#92400E' },
    orange: { bg: '#FFEDD5', border: '#EA580C44', text: '#9A3412' },
  }
  const s = styles[color]

  return (
    <div
      className="text-xs px-3 py-2 rounded-lg"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {children}
    </div>
  )
}

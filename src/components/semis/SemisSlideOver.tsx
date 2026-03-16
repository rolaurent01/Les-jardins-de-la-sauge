'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Field } from '@/components/ui/Field'
import type { Variety, ActionResult, Processus, Seedling, SeedlingStatut } from '@/lib/types'
import { SEEDLING_STATUT_LABELS } from '@/lib/types'
import type { SeedlingWithPlantsInfo } from '@/app/[orgSlug]/(dashboard)/semis/suivi/actions'
import {
  computeSeedlingLossRate,
  type MiniMotteLossStats,
  type CaissetteGodetLossStats,
} from '@/lib/utils/seedling-stats'
import QuickAddVariety from '@/components/varieties/QuickAddVariety'
import type { SeedLotForSelect } from './SemisClient'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'

/** Sections du formulaire progressif */
type Section = 'identite' | 'levee' | 'repiquage' | 'resultats'

/** Détermine la section à ouvrir selon le statut */
function sectionForStatut(statut: SeedlingStatut | undefined, processus: Processus): Section {
  if (!statut) return 'identite'
  switch (statut) {
    case 'semis':         return 'identite'
    case 'leve':          return 'levee'
    case 'repiquage':     return processus === 'caissette_godet' ? 'repiquage' : 'levee'
    case 'pret':
    case 'en_plantation':
    case 'epuise':        return 'resultats'
    default:              return 'identite'
  }
}

type Props = {
  open:      boolean
  seedling:  SeedlingWithPlantsInfo | null  // null = création
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

  const isEdit = seedling !== null

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

  /* Sections ouvertes — en création toutes ouvertes, en édition la section du statut */
  const [openSections, setOpenSections] = useState<Set<Section>>(() => {
    if (!seedling) return new Set(['identite', 'levee', 'repiquage', 'resultats'])
    const target = sectionForStatut(seedling.statut, seedling.processus)
    return new Set([target])
  })

  const [showAll, setShowAll] = useState(!isEdit)

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

    if (!seedling) {
      setOpenSections(new Set(['identite', 'levee', 'repiquage', 'resultats']))
      setShowAll(true)
    } else {
      const target = sectionForStatut(seedling.statut, seedling.processus)
      setOpenSections(new Set([target]))
      setShowAll(false)
    }
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

  function toggleSection(section: Section) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  function handleShowAll() {
    setShowAll(true)
    setOpenSections(new Set(['identite', 'levee', 'repiquage', 'resultats']))
  }

  function isSectionOpen(section: Section): boolean {
    return showAll || openSections.has(section)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('variety_id', selectedVarietyId)
    fd.set('processus', processus)
    fd.set('seed_lot_id', selectedSeedLotId)

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
    farm_id: '',          variety_id: null,     processus,
    numero_caisse: null,  statut: 'semis',
    nb_mottes: nbMottes,              nb_mortes_mottes: nbMortesMottes,
    nb_caissettes: null,
    nb_plants_caissette: nbPlantsC,   nb_mortes_caissette: nbMortesC,
    nb_godets: nbGodets,              nb_mortes_godet: nbMortesG,
    nb_donnees: nbDonnees,            nb_plants_obtenus: nbObtenus,
    date_semis: '',       poids_graines_utilise_g: null,
    date_levee: null,     date_repiquage: null,
    temps_semis_min: null, temps_repiquage_min: null,
    commentaire: null,    deleted_at: null,
    created_by: null,     updated_by: null,     created_at: '',
  }

  const showSummary = nbObtenus != null
  const lossStats   = showSummary ? computeSeedlingLossRate(previewSeedling) : null

  /* Indicateur de statut dans l'en-tête en mode édition */
  const statutBadge = isEdit && seedling ? (
    <span
      className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: STATUT_COLORS[seedling.statut].bg, color: STATUT_COLORS[seedling.statut].color }}
    >
      {SEEDLING_STATUT_LABELS[seedling.statut]}
    </span>
  ) : null

  /* Plants restants en mode édition */
  const plantsInfo = isEdit && seedling && seedling.plants_restants != null ? (
    <div className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
      {seedling.plants_plantes} planté{seedling.plants_plantes !== 1 ? 's' : ''}
      {' · '}
      {seedling.plants_restants} restant{seedling.plants_restants !== 1 ? 's' : ''}
    </div>
  ) : null

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
          <div>
            <h2 className="text-base font-semibold inline-flex items-center" style={{ color: '#2C3E2D' }}>
              {isEdit ? 'Modifier le semis' : 'Nouveau semis'}
              {statutBadge}
            </h2>
            {plantsInfo}
          </div>
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
          <div className="px-6 py-5 space-y-1 flex-1">

            {/* ===== Section 1 : Identité (semis) ===== */}
            <SectionHeader
              label="Identité du semis"
              section="identite"
              isOpen={isSectionOpen('identite')}
              onToggle={toggleSection}
              statut={isEdit ? seedling?.statut : undefined}
              activeStatuts={['semis']}
            />
            {isSectionOpen('identite') && (
              <div className="space-y-4 pb-4">
                {/* Sélecteur de processus */}
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
                      Mini-mottes
                    </ProcessBtn>
                    <ProcessBtn
                      active={processus === 'caissette_godet'}
                      onClick={() => setProcessus('caissette_godet')}
                      disabled={isPending}
                    >
                      Caissette/Godet
                    </ProcessBtn>
                  </div>
                </div>

                {/* Variété */}
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
                    onChange={e => { setVarietyId(e.target.value); setSeedLotId('') }}
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

                {/* Sachet source — filtré par variété sélectionnée */}
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
                    {seedLots
                      .filter(sl => !selectedVarietyId || sl.variety_id === selectedVarietyId)
                      .map(sl => (
                        <option key={sl.id} value={sl.id}>
                          {sl.lot_interne}
                          {sl.fournisseur ? ` — ${sl.fournisseur}` : ''}
                          {sl.numero_lot_fournisseur ? ` #${sl.numero_lot_fournisseur}` : ''}
                        </option>
                      ))
                    }
                  </select>
                </Field>

                {/* Date semis + Poids graines */}
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

                {/* N° de caisse (mini-motte uniquement) */}
                {processus === 'mini_motte' && (
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
                )}

                {/* Temps semis */}
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
              </div>
            )}

            {/* ===== Section 2 : Levée ===== */}
            <SectionHeader
              label={processus === 'mini_motte' ? 'Levée & comptage mottes' : 'Levée'}
              section="levee"
              isOpen={isSectionOpen('levee')}
              onToggle={toggleSection}
              statut={isEdit ? seedling?.statut : undefined}
              activeStatuts={['leve']}
            />
            {isSectionOpen('levee') && (
              <div className="space-y-4 pb-4">
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

                {/* Champs mini-motte */}
                {processus === 'mini_motte' && (
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
                )}

                {/* Champs caissette (étape caissette) */}
                {processus === 'caissette_godet' && (
                  <>
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
                  </>
                )}
              </div>
            )}

            {/* ===== Section 3 : Repiquage (caissette_godet uniquement) ===== */}
            {processus === 'caissette_godet' && (
              <>
                <SectionHeader
                  label="Repiquage en godet"
                  section="repiquage"
                  isOpen={isSectionOpen('repiquage')}
                  onToggle={toggleSection}
                  statut={isEdit ? seedling?.statut : undefined}
                  activeStatuts={['repiquage']}
                />
                {isSectionOpen('repiquage') && (
                  <div className="space-y-4 pb-4">
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
                )}
              </>
            )}

            {/* ===== Section 4 : Résultats ===== */}
            <SectionHeader
              label="Résultats & plantation"
              section="resultats"
              isOpen={isSectionOpen('resultats')}
              onToggle={toggleSection}
              statut={isEdit ? seedling?.statut : undefined}
              activeStatuts={['pret', 'en_plantation', 'epuise']}
            />
            {isSectionOpen('resultats') && (
              <div className="space-y-4 pb-4">
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

                {/* Temps repiquage pour mini-motte (pas de section repiquage) */}
                {processus === 'mini_motte' && (
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
                )}

                {/* Récapitulatif de perte */}
                {showSummary && lossStats && (
                  <LossSummary processus={processus} stats={lossStats} />
                )}
              </div>
            )}

            {/* ===== Commentaire (toujours visible) ===== */}
            <div className="pt-3">
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
            </div>

            {/* Bouton "Voir tous les champs" en mode édition */}
            {isEdit && !showAll && (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="w-full text-center py-2 rounded-lg text-sm border transition-colors"
                  style={{ borderColor: '#D8E0D9', color: 'var(--color-primary)' }}
                >
                  Voir / modifier tous les champs
                </button>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div
                className="text-sm px-3 py-2.5 rounded-lg mt-3"
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
                backgroundColor: 'var(--color-primary)',
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

/* ---- En-tête de section accordéon ---- */

function SectionHeader({
  label,
  section,
  isOpen,
  onToggle,
  statut,
  activeStatuts,
}: {
  label: string
  section: Section
  isOpen: boolean
  onToggle: (s: Section) => void
  statut?: SeedlingStatut
  activeStatuts: SeedlingStatut[]
}) {
  const isActive = statut != null && activeStatuts.includes(statut)

  return (
    <button
      type="button"
      onClick={() => onToggle(section)}
      className="w-full flex items-center gap-3 py-2.5 group"
    >
      {/* Indicateur actif */}
      <div
        className="rounded-full flex-shrink-0"
        style={{
          width: 8, height: 8,
          backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
          border: isActive ? 'none' : '2px solid #D8E0D9',
        }}
      />

      <span
        className="text-xs font-semibold uppercase tracking-wider flex-1 text-left"
        style={{ color: isActive ? 'var(--color-primary)' : '#9CA89D' }}
      >
        {label}
      </span>

      {/* Chevron */}
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        style={{
          color: '#9CA89D',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}
      >
        <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
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

function perteColors(pct: number | null): { bg: string; color: string } {
  if (pct == null) return { bg: '#F5F2ED', color: '#9CA89D' }
  if (pct < 20)   return { bg: '#DCFCE7', color: '#166534' }
  if (pct < 40)   return { bg: '#FEF3C7', color: '#92400E' }
  return           { bg: '#FEE2E2', color: '#991B1B' }
}

/* ---- Couleurs de badge pour le statut en en-tête ---- */

const STATUT_COLORS: Record<SeedlingStatut, { bg: string; color: string }> = {
  semis:          { bg: '#F5F2ED', color: '#6B7B6C' },
  leve:           { bg: '#DCFCE7', color: '#166534' },
  repiquage:      { bg: '#DBEAFE', color: '#1E40AF' },
  pret:           { bg: '#D1FAE5', color: '#065F46' },
  en_plantation:  { bg: '#FEF3C7', color: '#92400E' },
  epuise:         { bg: '#F5F2ED', color: '#9CA89D' },
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
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color:           active ? '#F9F8F6' : '#9CA89D',
      }}
    >
      {children}
    </button>
  )
}




'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Field } from '@/components/ui/Field'
import type {
  Variety,
  ActionResult,
  Bouture,
  CuttingStatut,
  TypeMultiplication,
} from '@/lib/types'
import { CUTTING_STATUT_LABELS, TYPE_MULTIPLICATION_LABELS } from '@/lib/types'
import type { CuttingWithPlantsInfo } from '@/app/[orgSlug]/(dashboard)/semis/boutures/actions'
import {
  computeCuttingLossRate,
  type PlaqueLossStats,
  type GodetDirectLossStats,
} from '@/lib/utils/cutting-stats'
import QuickAddVariety from '@/components/varieties/QuickAddVariety'
import { inputStyle, focusStyle, blurStyle } from '@/lib/ui/form-styles'
import DateYearWarning from '@/components/shared/DateYearWarning'

/** Sections du formulaire progressif */
type Section = 'identite' | 'plaque' | 'godet' | 'resultats'

/** Détermine la section à ouvrir selon le statut */
function sectionForStatut(statut: CuttingStatut | undefined, usePlaque: boolean): Section {
  if (!statut) return 'identite'
  switch (statut) {
    case 'bouture':       return 'identite'
    case 'repiquage':     return usePlaque ? 'godet' : 'identite'
    case 'pret':
    case 'en_plantation':
    case 'epuise':        return 'resultats'
    default:              return 'identite'
  }
}

type Props = {
  open:      boolean
  cutting:   CuttingWithPlantsInfo | null  // null = création
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]
  onClose:   () => void
  onSubmit:  (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

const ALL_TYPES: TypeMultiplication[] = [
  'rhizome', 'bouture', 'marcotte', 'eclat_pied', 'drageon', 'eclat_racine',
]

export default function BoutureSlideOver({
  open,
  cutting,
  varieties: initialVarieties,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const firstFieldRef                = useRef<HTMLSelectElement>(null)

  const isEdit = cutting !== null

  /* Liste locale des variétés */
  const [varieties, setVarieties]           = useState(initialVarieties)
  const [selectedVarietyId, setVarietyId]   = useState(cutting?.variety_id ?? '')
  const [typeMulti, setTypeMulti]           = useState<TypeMultiplication>(cutting?.type_multiplication ?? 'bouture')

  /* Toggle plaque / direct godet */
  const [usePlaque, setUsePlaque] = useState(cutting?.nb_plaques != null)

  /* Champs pour le récapitulatif de perte en temps réel */
  const [nbPlaques,       setNbPlaques]       = useState<number | null>(cutting?.nb_plaques ?? null)
  const [nbTrousPlaque,   setNbTrousPlaque]   = useState<number | null>(cutting?.nb_trous_par_plaque ?? null)
  const [nbMortesPlaque,  setNbMortesPlaque]  = useState(cutting?.nb_mortes_plaque ?? 0)
  const [nbGodets,        setNbGodets]        = useState<number | null>(cutting?.nb_godets ?? null)
  const [nbMortesGodet,   setNbMortesGodet]   = useState(cutting?.nb_mortes_godet ?? 0)
  const [nbDonnees,       setNbDonnees]       = useState(cutting?.nb_donnees ?? 0)
  const [nbObtenus,       setNbObtenus]       = useState<number | null>(cutting?.nb_plants_obtenus ?? null)

  /* Sections ouvertes */
  const [openSections, setOpenSections] = useState<Set<Section>>(() => {
    if (!cutting) return new Set(['identite', 'plaque', 'godet', 'resultats'])
    const target = sectionForStatut(cutting.statut, cutting.nb_plaques != null)
    return new Set([target])
  })

  const [showAll, setShowAll] = useState(!isEdit)
  const [dateBouturage, setDateBouturage] = useState(cutting?.date_bouturage ?? '')

  /* Resync variétés */
  useEffect(() => { setVarieties(initialVarieties) }, [initialVarieties])

  /* Resync complet quand on change de bouture */
  useEffect(() => {
    setVarietyId(cutting?.variety_id ?? '')
    setTypeMulti(cutting?.type_multiplication ?? 'bouture')
    setUsePlaque(cutting?.nb_plaques != null)
    setNbPlaques(cutting?.nb_plaques ?? null)
    setNbTrousPlaque(cutting?.nb_trous_par_plaque ?? null)
    setNbMortesPlaque(cutting?.nb_mortes_plaque ?? 0)
    setNbGodets(cutting?.nb_godets ?? null)
    setNbMortesGodet(cutting?.nb_mortes_godet ?? 0)
    setNbDonnees(cutting?.nb_donnees ?? 0)
    setNbObtenus(cutting?.nb_plants_obtenus ?? null)
    setDateBouturage(cutting?.date_bouturage ?? '')
    setError(null)

    if (!cutting) {
      setOpenSections(new Set(['identite', 'plaque', 'godet', 'resultats']))
      setShowAll(true)
    } else {
      const target = sectionForStatut(cutting.statut, cutting.nb_plaques != null)
      setOpenSections(new Set([target]))
      setShowAll(false)
    }
  }, [cutting])

  /* Focus le premier champ à l'ouverture */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  /* Fermeture Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

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
    setOpenSections(new Set(['identite', 'plaque', 'godet', 'resultats']))
  }

  function isSectionOpen(section: Section): boolean {
    return showAll || openSections.has(section)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('variety_id', selectedVarietyId)
    fd.set('type_multiplication', typeMulti)

    // Injecter les valeurs React state
    if (usePlaque) {
      fd.set('nb_plaques',          nbPlaques != null ? String(nbPlaques) : '')
      fd.set('nb_trous_par_plaque', nbTrousPlaque != null ? String(nbTrousPlaque) : '')
      fd.set('nb_mortes_plaque',    String(nbMortesPlaque))
    } else {
      fd.delete('nb_plaques')
      fd.delete('nb_trous_par_plaque')
      fd.delete('nb_mortes_plaque')
      fd.delete('date_mise_en_plaque')
    }
    fd.set('nb_godets',         nbGodets != null ? String(nbGodets) : '')
    fd.set('nb_mortes_godet',   String(nbMortesGodet))
    fd.set('nb_donnees',        String(nbDonnees))
    fd.set('nb_plants_obtenus', nbObtenus != null ? String(nbObtenus) : '')

    // Préserver les valeurs en mode édition si section fermée
    if (isEdit && cutting) {
      if (!fd.get('date_mise_en_plaque') && cutting.date_mise_en_plaque)
        fd.set('date_mise_en_plaque', cutting.date_mise_en_plaque)
      if (!fd.get('date_rempotage') && cutting.date_rempotage)
        fd.set('date_rempotage', cutting.date_rempotage)
      if (!fd.get('temps_bouturage_min') && cutting.temps_bouturage_min != null)
        fd.set('temps_bouturage_min', String(cutting.temps_bouturage_min))
      if (!fd.get('temps_rempotage_min') && cutting.temps_rempotage_min != null)
        fd.set('temps_rempotage_min', String(cutting.temps_rempotage_min))
      if (!fd.get('origine') && cutting.origine)
        fd.set('origine', cutting.origine)
      if (!fd.get('commentaire') && cutting.commentaire)
        fd.set('commentaire', cutting.commentaire)
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

  /* Objet Cutting virtuel pour le calcul de perte en temps réel */
  const previewCutting: Bouture = {
    id: '', farm_id: '', uuid_client: null, variety_id: null,
    type_multiplication: typeMulti, origine: null, certif_ab: false,
    statut: 'bouture',
    nb_plaques: usePlaque ? nbPlaques : null,
    nb_trous_par_plaque: usePlaque ? nbTrousPlaque : null,
    nb_mortes_plaque: nbMortesPlaque,
    date_mise_en_plaque: null, temps_bouturage_min: null,
    nb_godets: nbGodets, nb_mortes_godet: nbMortesGodet,
    date_rempotage: null, temps_rempotage_min: null,
    nb_plants_obtenus: nbObtenus, nb_donnees: nbDonnees,
    date_bouturage: '', commentaire: null,
    deleted_at: null, created_by: null, updated_by: null, created_at: '',
  }

  const showSummary = nbObtenus != null
  const lossStats   = showSummary ? computeCuttingLossRate(previewCutting) : null

  /* Badge statut en en-tête */
  const statutBadge = isEdit && cutting ? (
    <span
      className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: STATUT_COLORS[cutting.statut].bg, color: STATUT_COLORS[cutting.statut].color }}
    >
      {CUTTING_STATUT_LABELS[cutting.statut]}
    </span>
  ) : null

  const plantsInfo = isEdit && cutting && cutting.plants_restants != null ? (
    <div className="text-xs mt-1" style={{ color: '#6B7B6C' }}>
      {cutting.plants_plantes} planté{cutting.plants_plantes !== 1 ? 's' : ''}
      {' · '}
      {cutting.plants_restants} restant{cutting.plants_restants !== 1 ? 's' : ''}
    </div>
  ) : null

  return (
    <>
      {/* Overlay */}
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

      {/* Panneau */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Modifier la bouture' : 'Nouvelle bouture'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: '520px',
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
          <div>
            <h2 className="text-base font-semibold inline-flex items-center" style={{ color: '#2C3E2D' }}>
              {isEdit ? 'Modifier la bouture' : 'Nouvelle bouture'}
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

            {/* ===== Section 1 : Identité ===== */}
            <SectionHeader
              label="Identité de la bouture"
              section="identite"
              isOpen={isSectionOpen('identite')}
              onToggle={toggleSection}
              statut={isEdit ? cutting?.statut : undefined}
              activeStatuts={['bouture']}
            />
            {isSectionOpen('identite') && (
              <div className="space-y-4 pb-4">
                {/* Type de multiplication */}
                <Field label="Type de multiplication" required>
                  <select
                    ref={firstFieldRef}
                    name="type_multiplication"
                    required
                    value={typeMulti}
                    onChange={e => setTypeMulti(e.target.value as TypeMultiplication)}
                    disabled={isPending}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  >
                    {ALL_TYPES.map(t => (
                      <option key={t} value={t}>
                        {TYPE_MULTIPLICATION_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>

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

                {/* Origine + Certif AB */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Origine">
                    <input
                      name="origine"
                      type="text"
                      defaultValue={cutting?.origine ?? ''}
                      disabled={isPending}
                      placeholder="ex : Jardin La Sauge"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                  <Field label="Certifié AB">
                    <label className="flex items-center gap-2 mt-1">
                      <input
                        name="certif_ab"
                        type="checkbox"
                        defaultChecked={cutting?.certif_ab ?? false}
                        disabled={isPending}
                        className="rounded"
                      />
                      <span className="text-sm" style={{ color: '#2C3E2D' }}>Oui</span>
                    </label>
                  </Field>
                </div>

                {/* Date bouturage + Temps */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date de bouturage" required>
                    <input
                      name="date_bouturage"
                      type="date"
                      required
                      value={dateBouturage}
                      onChange={e => setDateBouturage(e.target.value)}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                    <DateYearWarning date={dateBouturage} />
                  </Field>
                  <Field label="Temps bouturage (min)">
                    <input
                      name="temps_bouturage_min"
                      type="number"
                      min="0"
                      defaultValue={cutting?.temps_bouturage_min ?? ''}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                </div>

                {/* Toggle plaque / direct godet */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
                    Support initial
                  </label>
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#D8E0D9' }}>
                    <ToggleBtn active={usePlaque} onClick={() => setUsePlaque(true)} disabled={isPending}>
                      Plaque alvéolée
                    </ToggleBtn>
                    <ToggleBtn active={!usePlaque} onClick={() => setUsePlaque(false)} disabled={isPending}>
                      Direct en godet
                    </ToggleBtn>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Section 2 : Plaque alvéolée (si usePlaque) ===== */}
            {usePlaque && (
              <>
                <SectionHeader
                  label="Plaque alvéolée"
                  section="plaque"
                  isOpen={isSectionOpen('plaque')}
                  onToggle={toggleSection}
                  statut={isEdit ? cutting?.statut : undefined}
                  activeStatuts={['bouture']}
                />
                {isSectionOpen('plaque') && (
                  <div className="space-y-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Nombre de plaques" required>
                        <input
                          name="nb_plaques"
                          type="number"
                          min="1"
                          required
                          value={nbPlaques ?? ''}
                          onChange={e => setNbPlaques(e.target.value ? parseInt(e.target.value, 10) : null)}
                          disabled={isPending}
                          placeholder="ex : 2"
                          style={inputStyle}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </Field>
                      <Field label="Trous par plaque" required>
                        <input
                          name="nb_trous_par_plaque"
                          type="number"
                          min="1"
                          required
                          value={nbTrousPlaque ?? ''}
                          onChange={e => setNbTrousPlaque(e.target.value ? parseInt(e.target.value, 10) : null)}
                          disabled={isPending}
                          placeholder="ex : 77"
                          style={inputStyle}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </Field>
                    </div>

                    {nbPlaques != null && nbTrousPlaque != null && (
                      <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#F5F2ED', color: '#6B7B6C' }}>
                        Total : {nbPlaques * nbTrousPlaque} boutures en plaque
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Mortes en plaque">
                        <input
                          name="nb_mortes_plaque"
                          type="number"
                          min="0"
                          value={nbMortesPlaque}
                          onChange={e => setNbMortesPlaque(e.target.value ? parseInt(e.target.value, 10) : 0)}
                          disabled={isPending}
                          style={inputStyle}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </Field>
                      <Field label="Date mise en plaque">
                        <input
                          name="date_mise_en_plaque"
                          type="date"
                          defaultValue={cutting?.date_mise_en_plaque ?? ''}
                          disabled={isPending}
                          style={inputStyle}
                          onFocus={focusStyle}
                          onBlur={blurStyle}
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== Section 3 : Godet (rempotage) ===== */}
            <SectionHeader
              label={usePlaque ? 'Rempotage en godet' : 'Mise en godet'}
              section="godet"
              isOpen={isSectionOpen('godet')}
              onToggle={toggleSection}
              statut={isEdit ? cutting?.statut : undefined}
              activeStatuts={['repiquage']}
            />
            {isSectionOpen('godet') && (
              <div className="space-y-4 pb-4">
                {usePlaque && (
                  <Field label="Date de rempotage">
                    <input
                      name="date_rempotage"
                      type="date"
                      defaultValue={cutting?.date_rempotage ?? ''}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                )}

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
                      value={nbMortesGodet}
                      onChange={e => setNbMortesGodet(e.target.value ? parseInt(e.target.value, 10) : 0)}
                      disabled={isPending}
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                </div>

                <Field label="Temps rempotage (min)">
                  <input
                    name="temps_rempotage_min"
                    type="number"
                    min="0"
                    defaultValue={cutting?.temps_rempotage_min ?? ''}
                    disabled={isPending}
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </Field>
              </div>
            )}

            {/* ===== Section 4 : Résultats ===== */}
            <SectionHeader
              label="Résultats & plantation"
              section="resultats"
              isOpen={isSectionOpen('resultats')}
              onToggle={toggleSection}
              statut={isEdit ? cutting?.statut : undefined}
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
                  <Field label="Plants obtenus">
                    <input
                      name="nb_plants_obtenus"
                      type="number"
                      min="0"
                      value={nbObtenus ?? ''}
                      onChange={e => setNbObtenus(e.target.value ? parseInt(e.target.value, 10) : null)}
                      disabled={isPending}
                      placeholder="ex : 30"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                    />
                  </Field>
                </div>

                {/* Récapitulatif de perte */}
                {showSummary && lossStats && (
                  <LossSummary usePlaque={usePlaque} stats={lossStats} />
                )}
              </div>
            )}

            {/* Commentaire (toujours visible) */}
            <div className="pt-3">
              <Field label="Commentaire">
                <textarea
                  name="commentaire"
                  rows={3}
                  defaultValue={cutting?.commentaire ?? ''}
                  disabled={isPending}
                  placeholder="Observations, conditions…"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Bouton voir tous les champs */}
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
                : isEdit ? 'Enregistrer'      : 'Créer la bouture'}
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
  statut?: CuttingStatut
  activeStatuts: CuttingStatut[]
}) {
  const isActive = statut != null && activeStatuts.includes(statut)

  return (
    <button
      type="button"
      onClick={() => onToggle(section)}
      className="w-full flex items-center gap-3 py-2.5 group"
    >
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

/* ---- Récapitulatif de perte ---- */

function LossSummary({
  usePlaque,
  stats,
}: {
  usePlaque: boolean
  stats: PlaqueLossStats | GodetDirectLossStats
}) {
  if (usePlaque && 'perte_globale_pct' in stats) {
    return <PlaqueSummary stats={stats} />
  }
  if (!usePlaque && 'perte_pct' in stats) {
    return <GodetSummary stats={stats} />
  }
  return null
}

function PlaqueSummary({ stats }: { stats: PlaqueLossStats }) {
  const pct = stats.perte_globale_pct
  const { bg, color } = perteColors(pct)
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: bg, color }}>
      <p className="font-semibold mb-1">Récapitulatif</p>
      <p>
        {stats.total_depart} boutures → {stats.plantes} obtenus
        {` (${stats.mortes_plaque} mortes plaque`}
        {stats.mortes_godet > 0 ? ` + ${stats.mortes_godet} mortes godet` : ''}
        {stats.donnees > 0 ? ` + ${stats.donnees} donnés` : ''}
        {')'}
        {pct != null ? ` = ${Math.round(pct)}% de perte` : ''}
      </p>
    </div>
  )
}

function GodetSummary({ stats }: { stats: GodetDirectLossStats }) {
  const pct = stats.perte_pct
  const { bg, color } = perteColors(pct)
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: bg, color }}>
      <p className="font-semibold mb-1">Récapitulatif</p>
      <p>
        {stats.total_depart} godets → {stats.plantes} obtenus
        {` (${stats.mortes_godet} mortes`}
        {stats.donnees > 0 ? ` + ${stats.donnees} donnés` : ''}
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

/* ---- Couleurs de badge statut ---- */

const STATUT_COLORS: Record<CuttingStatut, { bg: string; color: string }> = {
  bouture:        { bg: '#F5F2ED', color: '#6B7B6C' },
  repiquage:      { bg: '#DBEAFE', color: '#1E40AF' },
  pret:           { bg: '#D1FAE5', color: '#065F46' },
  en_plantation:  { bg: '#FEF3C7', color: '#92400E' },
  epuise:         { bg: '#F5F2ED', color: '#9CA89D' },
}

/* ---- Toggle bouton ---- */

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
      className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#F9F8F6' : '#9CA89D',
      }}
    >
      {children}
    </button>
  )
}

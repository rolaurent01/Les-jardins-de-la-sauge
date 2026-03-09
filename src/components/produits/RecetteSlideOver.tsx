'use client'

import { useState, useTransition, useEffect, useRef, forwardRef } from 'react'
import type { RecipeWithRelations, ProductCategory, Variety, ExternalMaterial, ActionResult, PartiePlante } from '@/lib/types'
import { PARTIES_PLANTE, PARTIE_PLANTE_LABELS } from '@/lib/types'

/** Etats plante utilisables en production (exclure tronconnee seule) */
const ETATS_PRODUCTION: string[] = [
  'frais',
  'sechee',
  'tronconnee_sechee',
  'sechee_triee',
  'tronconnee_sechee_triee',
]

const ETAT_LABELS: Record<string, string> = {
  frais: 'Frais',
  sechee: 'Sechee',
  tronconnee_sechee: 'Tronc. sechee',
  sechee_triee: 'Sechee triee',
  tronconnee_sechee_triee: 'Tronc. sechee triee',
}

type IngredientRow = {
  tempId: string
  type: 'plante' | 'materiau'
  variety_id: string
  external_material_id: string
  partie_plante: string
  etat_plante: string
  pourcentage: number // decimal 0-1
  ordre: number
}

type Props = {
  open: boolean
  recipe: RecipeWithRelations | null
  categories: ProductCategory[]
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'parties_utilisees'>[]
  materials: Pick<ExternalMaterial, 'id' | 'nom'>[]
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

function newTempId() {
  return crypto.randomUUID()
}

function emptyIngredient(ordre: number): IngredientRow {
  return {
    tempId: newTempId(),
    type: 'plante',
    variety_id: '',
    external_material_id: '',
    partie_plante: '',
    etat_plante: '',
    pourcentage: 0,
    ordre,
  }
}

/** Convertit les RecipeIngredient existants en IngredientRow */
function ingredientsFromRecipe(recipe: RecipeWithRelations): IngredientRow[] {
  return recipe.recipe_ingredients
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    .map((ing, idx) => ({
      tempId: newTempId(),
      type: ing.variety_id ? 'plante' : 'materiau',
      variety_id: ing.variety_id ?? '',
      external_material_id: ing.external_material_id ?? '',
      partie_plante: ing.partie_plante ?? '',
      etat_plante: ing.etat_plante ?? '',
      pourcentage: ing.pourcentage,
      ordre: ing.ordre ?? idx,
    }))
}

export default function RecetteSlideOver({
  open,
  recipe,
  categories,
  varieties,
  materials,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const isEdit = recipe !== null

  // ---- State ingredients ----
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe ? ingredientsFromRecipe(recipe) : [emptyIngredient(0)],
  )

  // Resync a l'ouverture/changement de recipe
  useEffect(() => {
    setIngredients(recipe ? ingredientsFromRecipe(recipe) : [emptyIngredient(0)])
    setError(null)
  }, [recipe])

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

  // ---- Helpers ingredients ----
  function updateIngredient(tempId: string, patch: Partial<IngredientRow>) {
    setIngredients(prev =>
      prev.map(ing => (ing.tempId === tempId ? { ...ing, ...patch } : ing)),
    )
  }

  function removeIngredient(tempId: string) {
    setIngredients(prev => prev.filter(ing => ing.tempId !== tempId))
  }

  function addIngredient() {
    setIngredients(prev => [...prev, emptyIngredient(prev.length)])
  }

  // Somme des pourcentages
  const totalPct = ingredients.reduce((sum, ing) => sum + ing.pourcentage, 0)
  const totalPctDisplay = Math.round(totalPct * 1000) / 10 // ex: 99.8%
  const totalIsOk = Math.abs(totalPct - 1.0) <= 0.001

  // ---- Submit ----
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)

    // Serialiser les ingredients en JSON
    const ingredientsPayload = ingredients.map(ing => ({
      variety_id: ing.type === 'plante' ? ing.variety_id || null : null,
      external_material_id: ing.type === 'materiau' ? ing.external_material_id || null : null,
      etat_plante: ing.type === 'plante' ? ing.etat_plante || null : null,
      partie_plante: ing.type === 'plante' ? ing.partie_plante || null : null,
      pourcentage: ing.pourcentage,
      ordre: ing.ordre,
    }))

    fd.set('ingredients', JSON.stringify(ingredientsPayload))

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  /** Retourne les parties_utilisees d'une variete */
  function getVarietyParts(varietyId: string): PartiePlante[] {
    const v = varieties.find(v => v.id === varietyId)
    return (v?.parties_utilisees ?? []) as PartiePlante[]
  }

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
        aria-label={isEdit ? 'Modifier la recette' : 'Nouvelle recette'}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: '580px',
          backgroundColor: '#FAF5E9',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
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
            {isEdit ? 'Modifier la recette' : 'Nouvelle recette'}
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

            {/* Nom */}
            <Field label="Nom" required>
              <input
                ref={firstFieldRef}
                name="nom"
                type="text"
                required
                maxLength={200}
                defaultValue={recipe?.nom ?? ''}
                disabled={isPending}
                placeholder="Nom de la recette"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Grille 2 colonnes */}
            <div className="grid grid-cols-2 gap-4">
              {/* Categorie */}
              <Field label="Categorie">
                <select
                  name="category_id"
                  defaultValue={recipe?.category_id ?? ''}
                  disabled={isPending}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                >
                  <option value="">— Aucune</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </Field>

              {/* N° tisane */}
              <Field label="N° tisane">
                <input
                  name="numero_tisane"
                  type="text"
                  defaultValue={recipe?.numero_tisane ?? ''}
                  disabled={isPending}
                  placeholder="ex: T01"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            {/* Poids sachet */}
            <Field label="Poids sachet (g)" required>
              <input
                name="poids_sachet_g"
                type="number"
                required
                min="0.01"
                step="0.01"
                defaultValue={recipe?.poids_sachet_g ?? ''}
                disabled={isPending}
                placeholder="en grammes"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* Description */}
            <Field label="Description">
              <textarea
                name="description"
                rows={2}
                maxLength={1000}
                defaultValue={recipe?.description ?? ''}
                disabled={isPending}
                placeholder="Description optionnelle…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            {/* ---- Section Ingredients ---- */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C3E2D' }}>
                Ingredients <span style={{ color: '#BC6C25' }}>*</span>
              </label>

              <div className="space-y-3">
                {ingredients.map((ing, idx) => (
                  <IngredientRowEditor
                    key={ing.tempId}
                    ingredient={ing}
                    index={idx}
                    varieties={varieties}
                    materials={materials}
                    disabled={isPending}
                    getVarietyParts={getVarietyParts}
                    onChange={(patch) => updateIngredient(ing.tempId, patch)}
                    onRemove={() => removeIngredient(ing.tempId)}
                    canRemove={ingredients.length > 1}
                  />
                ))}
              </div>

              {/* Bouton ajouter */}
              <button
                type="button"
                onClick={addIngredient}
                disabled={isPending}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={{ borderColor: '#D8E0D9', color: '#6B7B6C' }}
              >
                <span className="text-sm leading-none">+</span>
                Ajouter un ingredient
              </button>

              {/* Barre recapitulative */}
              <div
                className="mt-3 px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: totalIsOk ? '#DCFCE7' : totalPct > 1 ? '#FEE2E2' : '#FEF3C7',
                  color: totalIsOk ? '#166534' : totalPct > 1 ? '#991B1B' : '#92400E',
                  border: `1px solid ${totalIsOk ? '#16653444' : totalPct > 1 ? '#991B1B44' : '#F59E0B44'}`,
                }}
              >
                Total : {totalPctDisplay}%
                {!totalIsOk && (
                  <span className="ml-2 font-normal text-xs">
                    (doit etre 100%)
                  </span>
                )}
              </div>
            </div>

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
                ? isEdit ? 'Enregistrement…' : 'Creation…'
                : isEdit ? 'Enregistrer' : 'Creer la recette'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

/* ---- Editeur d'ingredient (une ligne) ---- */

function IngredientRowEditor({
  ingredient,
  index,
  varieties,
  materials,
  disabled,
  getVarietyParts,
  onChange,
  onRemove,
  canRemove,
}: {
  ingredient: IngredientRow
  index: number
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'parties_utilisees'>[]
  materials: Pick<ExternalMaterial, 'id' | 'nom'>[]
  disabled: boolean
  getVarietyParts: (varietyId: string) => PartiePlante[]
  onChange: (patch: Partial<IngredientRow>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const parts = ingredient.variety_id ? getVarietyParts(ingredient.variety_id) : []

  function handleTypeChange(type: 'plante' | 'materiau') {
    onChange({
      type,
      variety_id: '',
      external_material_id: '',
      partie_plante: '',
      etat_plante: '',
    })
  }

  function handleVarietyChange(varietyId: string) {
    const newParts = varietyId ? getVarietyParts(varietyId) : []
    onChange({
      variety_id: varietyId,
      partie_plante: newParts.length === 1 ? newParts[0] : '',
      etat_plante: ingredient.etat_plante,
    })
  }

  function handlePourcentageChange(displayValue: string) {
    const num = parseFloat(displayValue)
    if (isNaN(num)) {
      onChange({ pourcentage: 0 })
    } else {
      // Convertir de % (0-100) en decimal (0-1)
      onChange({ pourcentage: Math.round(num * 10) / 1000 })
    }
  }

  const partieOptions: PartiePlante[] = parts.length > 0 ? parts : [...PARTIES_PLANTE]

  return (
    <div
      className="p-3 rounded-lg border space-y-2"
      style={{ borderColor: '#D8E0D9', backgroundColor: '#F9F8F6' }}
    >
      {/* Ligne 1 : type + ingredient + supprimer */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium flex-shrink-0" style={{ color: '#9CA89D', width: '20px' }}>
          {index + 1}.
        </span>

        {/* Toggle type */}
        <div className="flex gap-1 flex-shrink-0">
          <ToggleBtn
            active={ingredient.type === 'plante'}
            onClick={() => handleTypeChange('plante')}
            disabled={disabled}
          >
            Plante
          </ToggleBtn>
          <ToggleBtn
            active={ingredient.type === 'materiau'}
            onClick={() => handleTypeChange('materiau')}
            disabled={disabled}
          >
            Materiau
          </ToggleBtn>
        </div>

        {/* Select ingredient */}
        <div className="flex-1">
          {ingredient.type === 'plante' ? (
            <select
              value={ingredient.variety_id}
              onChange={e => handleVarietyChange(e.target.value)}
              disabled={disabled}
              style={inputStyleSm}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              <option value="">— Variete</option>
              {varieties.map(v => (
                <option key={v.id} value={v.id}>{v.nom_vernaculaire}</option>
              ))}
            </select>
          ) : (
            <select
              value={ingredient.external_material_id}
              onChange={e => onChange({ external_material_id: e.target.value })}
              disabled={disabled}
              style={inputStyleSm}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              <option value="">— Materiau</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          )}
        </div>

        {/* Supprimer */}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="p-1 rounded transition-colors flex-shrink-0"
            style={{ color: '#9CA89D' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
            title="Supprimer"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Ligne 2 : partie + etat + pourcentage */}
      <div className="flex items-center gap-2 pl-[28px]">
        {/* Partie plante (visible si plante) */}
        {ingredient.type === 'plante' && (
          <select
            value={ingredient.partie_plante}
            onChange={e => onChange({ partie_plante: e.target.value })}
            disabled={disabled}
            style={{ ...inputStyleSm, flex: '1' }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <option value="">— Partie</option>
            {partieOptions.map(p => (
              <option key={p} value={p}>{PARTIE_PLANTE_LABELS[p]}</option>
            ))}
          </select>
        )}

        {/* Etat plante (visible si plante) */}
        {ingredient.type === 'plante' && (
          <select
            value={ingredient.etat_plante}
            onChange={e => onChange({ etat_plante: e.target.value })}
            disabled={disabled}
            style={{ ...inputStyleSm, flex: '1' }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <option value="">— Etat</option>
            {ETATS_PRODUCTION.map(e => (
              <option key={e} value={e}>{ETAT_LABELS[e] ?? e}</option>
            ))}
          </select>
        )}

        {/* Pourcentage */}
        <div className="flex items-center gap-1 flex-shrink-0" style={{ width: ingredient.type === 'plante' ? '80px' : '100%' }}>
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={ingredient.pourcentage > 0 ? Math.round(ingredient.pourcentage * 1000) / 10 : ''}
            onChange={e => handlePourcentageChange(e.target.value)}
            disabled={disabled}
            placeholder="%"
            style={{ ...inputStyleSm, width: '100%', textAlign: 'right' }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
          <span className="text-xs flex-shrink-0" style={{ color: '#9CA89D' }}>%</span>
        </div>
      </div>
    </div>
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

const inputStyleSm: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid #D8E0D9',
  backgroundColor: '#FAF5E9',
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

/** Bouton toggle pour le choix de type d'ingredient */
const ToggleBtn = forwardRef<
  HTMLButtonElement,
  {
    active: boolean
    onClick: () => void
    disabled: boolean
    children: React.ReactNode
  }
>(function ToggleBtn({ active, onClick, disabled, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#F9F8F6' : '#6B7B6C',
        border: active ? '1px solid var(--color-primary)' : '1px solid #D8E0D9',
        opacity: disabled && !active ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
})

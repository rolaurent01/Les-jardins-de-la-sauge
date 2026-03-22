import { useState, useCallback, useRef } from 'react'

type SpacingField = 'nb_plants' | 'espacement_cm' | 'longueur_m'

/**
 * Calcul bidirectionnel d'espacement entre plants.
 * L'utilisateur remplit 2 champs sur 3, le 3e se calcule automatiquement.
 *
 * Formules :
 *   espacement_cm = longueur_m × 100 / nb_plants
 *   nb_plants     = longueur_m × 100 / espacement_cm
 *   longueur_m    = nb_plants × espacement_cm / 100
 */
export function useSpacingCalc() {
  const [autoField, setAutoField] = useState<SpacingField | null>(null)
  const manualFieldsRef = useRef<SpacingField[]>([])

  /**
   * Appelé quand l'utilisateur modifie manuellement un des 3 champs.
   * Retourne { field, value } si un champ doit être auto-rempli, null sinon.
   */
  const computeSpacing = useCallback(
    (
      editedField: SpacingField,
      newValue: string,
      currentValues: { nb_plants: string; espacement_cm: string; longueur_m: string },
    ): { field: SpacingField; value: string } | null => {
      // Mémoriser les 2 derniers champs édités manuellement
      const manual = [editedField, ...manualFieldsRef.current.filter(f => f !== editedField)].slice(0, 2) as SpacingField[]
      manualFieldsRef.current = manual

      // Le champ à calculer = celui qui n'est PAS dans les 2 derniers manuels
      const allFields: SpacingField[] = ['nb_plants', 'espacement_cm', 'longueur_m']
      const target = allFields.find(f => !manual.includes(f)) ?? null

      if (!target) {
        setAutoField(null)
        return null
      }

      // Valeurs avec le champ édité mis à jour
      const vals = { ...currentValues, [editedField]: newValue }
      const nb = parseFloat(vals.nb_plants)
      const esp = parseFloat(vals.espacement_cm)
      const lon = parseFloat(vals.longueur_m)

      let autoValue: string | null = null

      if (target === 'espacement_cm' && nb > 0 && lon > 0) {
        autoValue = Math.round(lon * 100 / nb).toString()
      } else if (target === 'nb_plants' && esp > 0 && lon > 0) {
        autoValue = Math.round(lon * 100 / esp).toString()
      } else if (target === 'longueur_m' && nb > 0 && esp > 0) {
        const computed = nb * esp / 100
        autoValue = computed % 1 === 0 ? computed.toString() : computed.toFixed(1)
      }

      if (autoValue !== null) {
        setAutoField(target)
        return { field: target, value: autoValue }
      }

      setAutoField(null)
      return null
    },
    [],
  )

  /** Marquer un champ comme "manuellement défini" sans déclencher de calcul (ex: pré-remplissage depuis le rang) */
  const markManual = useCallback((field: SpacingField) => {
    const manual = [field, ...manualFieldsRef.current.filter(f => f !== field)].slice(0, 2) as SpacingField[]
    manualFieldsRef.current = manual
  }, [])

  const resetSpacing = useCallback(() => {
    setAutoField(null)
    manualFieldsRef.current = []
  }, [])

  return { autoField, computeSpacing, markManual, resetSpacing }
}

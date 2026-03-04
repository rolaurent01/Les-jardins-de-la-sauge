'use client'

/**
 * Hook logique adaptative pour les variétés actives d'un rang.
 * Requête les plantings actifs du rang et expose une auto-sélection
 * si une seule variété est présente — utilisé par suivi de rang,
 * cueillette et arrachage.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type RowVariety = {
  id: string
  nom_vernaculaire: string
}

type UseRowVarietiesResult = {
  /** Variétés uniques actives plantées sur le rang */
  varieties: RowVariety[]
  loading: boolean
  /** Non-null si exactement 1 variété active → auto-remplissage du formulaire */
  autoVariety: RowVariety | null
}

/**
 * Retourne les variétés actives sur un rang donné.
 * Si le rang a exactement 1 variété, `autoVariety` est non-null
 * et le formulaire peut pré-remplir variety_id sans action utilisateur.
 */
export function useRowVarieties(rowId: string | null): UseRowVarietiesResult {
  const [varieties, setVarieties] = useState<RowVariety[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!rowId) {
      setVarieties([])
      return
    }

    let cancelled = false
    setLoading(true)

    const supabase = createClient()

    supabase
      .from('plantings')
      .select('variety_id, varieties(id, nom_vernaculaire)')
      .eq('row_id', rowId)
      .eq('actif', true)
      .is('deleted_at', null)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setVarieties([])
          setLoading(false)
          return
        }

        // Dédoublonnage par variety_id
        const seen = new Set<string>()
        const unique: RowVariety[] = []
        for (const row of data) {
          const rawRow = row as unknown as { varieties: RowVariety | null }
          const v = rawRow.varieties
          if (v && !seen.has(v.id)) {
            seen.add(v.id)
            unique.push({ id: v.id, nom_vernaculaire: v.nom_vernaculaire })
          }
        }

        setVarieties(unique)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [rowId])

  const autoVariety = varieties.length === 1 ? varieties[0] : null

  return { varieties, loading, autoVariety }
}

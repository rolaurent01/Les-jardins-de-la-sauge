'use client'

/**
 * Hook logique adaptative pour les parties de plante d'une variété.
 * Lit varieties.parties_utilisees et expose une auto-sélection
 * si la variété n'a qu'une seule partie — utilisé à la cueillette.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PartiePlante } from '@/lib/types'

type UseVarietyPartsResult = {
  /** Parties utilisées pour la variété */
  parts: PartiePlante[]
  loading: boolean
  /** Non-null si exactement 1 partie → auto-remplissage du formulaire */
  autoPart: PartiePlante | null
}

/**
 * Retourne les parties de plante disponibles pour une variété.
 * Si la variété n'a qu'une seule partie dans `parties_utilisees`,
 * `autoPart` est non-null et le formulaire peut pré-remplir partie_plante.
 */
export function useVarietyParts(varietyId: string | null): UseVarietyPartsResult {
  const [parts, setParts] = useState<PartiePlante[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!varietyId) {
      setParts([])
      return
    }

    let cancelled = false
    setLoading(true)

    const supabase = createClient()

    supabase
      .from('varieties')
      .select('parties_utilisees')
      .eq('id', varietyId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setParts([])
          setLoading(false)
          return
        }

        const rawParts = (data.parties_utilisees ?? []) as PartiePlante[]
        setParts(rawParts)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [varietyId])

  const autoPart = parts.length === 1 ? parts[0] : null

  return { parts, loading, autoPart }
}

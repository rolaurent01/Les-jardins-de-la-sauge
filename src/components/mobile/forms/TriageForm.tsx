'use client'

import CombinedTransformationMobileForm from './CombinedTransformationMobileForm'
import { sortingCombinedSchema } from '@/lib/validation/transformation'

interface TriageFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Triage combiné (entrée + sortie en 1 formulaire).
 * L'utilisateur choisit l'état plante d'entrée, la sortie est déduite.
 * Affiche la ligne déchet (entrée - sortie).
 */
export default function TriageForm({ orgSlug }: TriageFormProps) {
  return (
    <CombinedTransformationMobileForm
      orgSlug={orgSlug}
      title="Triage"
      tableCible="sortings_combined"
      schema={sortingCombinedSchema}
      backCategory="transfo"
      etatPlanteConfig={{
        entree: [
          { value: 'sechee', label: 'Séchée' },
          { value: 'tronconnee_sechee', label: 'Tronçonnée séchée' },
        ],
      }}
      stockEntreeEtats={['sechee', 'tronconnee_sechee']}
    />
  )
}

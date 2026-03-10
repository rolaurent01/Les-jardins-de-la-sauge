'use client'

import TransformationMobileForm from './TransformationMobileForm'
import { sortingSchema } from '@/lib/validation/transformation'

interface TriageFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Triage (sortings).
 * État plante conditionnel : entrée = sechee|tronconnee_sechee, sortie = sechee_triee|tronconnee_sechee_triee.
 */
export default function TriageForm({ orgSlug }: TriageFormProps) {
  return (
    <TransformationMobileForm
      orgSlug={orgSlug}
      title="Triage"
      tableCible="sortings"
      schema={sortingSchema}
      backCategory="transfo"
      etatPlanteConfig={{
        entree: [
          { value: 'sechee', label: 'Séchée' },
          { value: 'tronconnee_sechee', label: 'Tronçonnée séchée' },
        ],
        sortie: [
          { value: 'sechee_triee', label: 'Séchée triée' },
          { value: 'tronconnee_sechee_triee', label: 'Tronçonnée séchée triée' },
        ],
      }}
    />
  )
}

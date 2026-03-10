'use client'

import TransformationMobileForm from './TransformationMobileForm'
import { dryingSchema } from '@/lib/validation/transformation'

interface SechageFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Séchage (dryings).
 * État plante conditionnel : entrée = frais|tronconnee, sortie = sechee|tronconnee_sechee.
 */
export default function SechageForm({ orgSlug }: SechageFormProps) {
  return (
    <TransformationMobileForm
      orgSlug={orgSlug}
      title="Séchage"
      tableCible="dryings"
      schema={dryingSchema}
      backCategory="transfo"
      etatPlanteConfig={{
        entree: [
          { value: 'frais', label: 'Frais' },
          { value: 'tronconnee', label: 'Tronçonnée' },
        ],
        sortie: [
          { value: 'sechee', label: 'Séchée' },
          { value: 'tronconnee_sechee', label: 'Tronçonnée séchée' },
        ],
      }}
    />
  )
}

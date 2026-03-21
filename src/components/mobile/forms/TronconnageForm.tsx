'use client'

import CombinedTransformationMobileForm from './CombinedTransformationMobileForm'
import { cuttingCombinedSchema } from '@/lib/validation/transformation'

interface TronconnageFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Tronçonnage combiné (entrée + sortie en 1 formulaire).
 * Poids sortie pré-rempli = poids entrée (modifiable).
 */
export default function TronconnageForm({ orgSlug }: TronconnageFormProps) {
  return (
    <CombinedTransformationMobileForm
      orgSlug={orgSlug}
      title="Tronçonnage"
      tableCible="cuttings_combined"
      schema={cuttingCombinedSchema}
      backCategory="transfo"
      autoSyncPoidsSortie
    />
  )
}

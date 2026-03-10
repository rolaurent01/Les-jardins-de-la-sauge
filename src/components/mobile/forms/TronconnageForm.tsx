'use client'

import TransformationMobileForm from './TransformationMobileForm'
import { cuttingSchema } from '@/lib/validation/transformation'

interface TronconnageFormProps {
  orgSlug: string
}

/**
 * Formulaire mobile — Tronçonnage (cuttings).
 * État plante implicite : entrée = frais, sortie = tronconnee.
 */
export default function TronconnageForm({ orgSlug }: TronconnageFormProps) {
  return (
    <TransformationMobileForm
      orgSlug={orgSlug}
      title="Tronçonnage"
      tableCible="cuttings"
      schema={cuttingSchema}
      backCategory="transfo"
      etatPlanteConfig={null}
      getImplicitEtatPlante={(type) => (type === 'entree' ? 'frais' : 'tronconnee')}
    />
  )
}

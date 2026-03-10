'use client'

import VenteForm from '@/components/mobile/forms/VenteForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire vente directe */
export default function VentePage() {
  const params = useParams<{ orgSlug: string }>()
  return <VenteForm orgSlug={params.orgSlug} />
}

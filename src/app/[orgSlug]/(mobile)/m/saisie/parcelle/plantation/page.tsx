'use client'

import PlantationForm from '@/components/mobile/forms/PlantationForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire plantation */
export default function PlantationPage() {
  const params = useParams<{ orgSlug: string }>()
  return <PlantationForm orgSlug={params.orgSlug} />
}

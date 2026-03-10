'use client'

import OccultationForm from '@/components/mobile/forms/OccultationForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire occultation */
export default function OccultationPage() {
  const params = useParams<{ orgSlug: string }>()
  return <OccultationForm orgSlug={params.orgSlug} />
}

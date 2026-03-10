'use client'

import TriageForm from '@/components/mobile/forms/TriageForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire triage */
export default function TriagePage() {
  const params = useParams<{ orgSlug: string }>()
  return <TriageForm orgSlug={params.orgSlug} />
}

'use client'

import SuiviSemisForm from '@/components/mobile/forms/SuiviSemisForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire suivi semis */
export default function SuiviSemisPage() {
  const params = useParams<{ orgSlug: string }>()
  return <SuiviSemisForm orgSlug={params.orgSlug} />
}

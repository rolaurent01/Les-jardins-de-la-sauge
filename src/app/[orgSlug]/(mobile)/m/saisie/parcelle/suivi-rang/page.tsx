'use client'

import SuiviRangForm from '@/components/mobile/forms/SuiviRangForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire suivi de rang */
export default function SuiviRangPage() {
  const params = useParams<{ orgSlug: string }>()
  return <SuiviRangForm orgSlug={params.orgSlug} />
}

'use client'

import ArrachageForm from '@/components/mobile/forms/ArrachageForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire arrachage */
export default function ArrachagePage() {
  const params = useParams<{ orgSlug: string }>()
  return <ArrachageForm orgSlug={params.orgSlug} />
}

'use client'

import TravailSolForm from '@/components/mobile/forms/TravailSolForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire travail de sol */
export default function TravailSolPage() {
  const params = useParams<{ orgSlug: string }>()
  return <TravailSolForm orgSlug={params.orgSlug} />
}

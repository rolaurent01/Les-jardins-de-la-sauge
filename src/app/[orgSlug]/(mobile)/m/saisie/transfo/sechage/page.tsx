'use client'

import SechageForm from '@/components/mobile/forms/SechageForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire séchage */
export default function SechagePage() {
  const params = useParams<{ orgSlug: string }>()
  return <SechageForm orgSlug={params.orgSlug} />
}

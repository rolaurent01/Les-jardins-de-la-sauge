'use client'

import BoutureForm from '@/components/mobile/forms/BoutureForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire bouture */
export default function BouturePage() {
  const params = useParams<{ orgSlug: string }>()
  return <BoutureForm orgSlug={params.orgSlug} />
}

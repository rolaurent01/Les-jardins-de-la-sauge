'use client'

import SachetForm from '@/components/mobile/forms/SachetForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire sachet de graines */
export default function SachetPage() {
  const params = useParams<{ orgSlug: string }>()
  return <SachetForm orgSlug={params.orgSlug} />
}

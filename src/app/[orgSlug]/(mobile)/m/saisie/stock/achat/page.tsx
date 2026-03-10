'use client'

import AchatForm from '@/components/mobile/forms/AchatForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire achat externe */
export default function AchatPage() {
  const params = useParams<{ orgSlug: string }>()
  return <AchatForm orgSlug={params.orgSlug} />
}

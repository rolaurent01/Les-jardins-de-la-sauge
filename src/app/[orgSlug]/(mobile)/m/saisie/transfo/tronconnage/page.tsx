'use client'

import TronconnageForm from '@/components/mobile/forms/TronconnageForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire tronçonnage */
export default function TronconnagePage() {
  const params = useParams<{ orgSlug: string }>()
  return <TronconnageForm orgSlug={params.orgSlug} />
}

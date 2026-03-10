'use client'

import CueilletteForm from '@/components/mobile/forms/CueilletteForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire cueillette */
export default function CueillettePage() {
  const params = useParams<{ orgSlug: string }>()
  return <CueilletteForm orgSlug={params.orgSlug} />
}

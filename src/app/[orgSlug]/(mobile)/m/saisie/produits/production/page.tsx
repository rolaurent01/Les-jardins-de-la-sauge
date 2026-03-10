'use client'

import ProductionLotForm from '@/components/mobile/forms/ProductionLotForm'
import { useParams } from 'next/navigation'

/** Page mobile — Formulaire production de lot */
export default function ProductionPage() {
  const params = useParams<{ orgSlug: string }>()
  return <ProductionLotForm orgSlug={params.orgSlug} />
}

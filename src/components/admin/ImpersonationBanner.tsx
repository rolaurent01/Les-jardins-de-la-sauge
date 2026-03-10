'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { stopImpersonation } from '@/app/[orgSlug]/(dashboard)/admin/outils/actions'

/**
 * Bandeau rouge fixe affiché en haut de TOUTES les pages bureau
 * quand l'admin est en mode impersonation.
 */
export default function ImpersonationBanner({
  farmName,
  orgSlug,
}: {
  farmName: string
  orgSlug: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleStop() {
    await stopImpersonation()
    startTransition(() => {
      router.push(`/${orgSlug}/admin/outils`)
      router.refresh()
    })
  }

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center gap-3"
      style={{
        backgroundColor: '#DC2626',
        color: '#fff',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
      }}
    >
      <span>Impersonation active — Ferme : {farmName}</span>
      <button
        onClick={handleStop}
        disabled={isPending}
        style={{
          padding: '4px 12px',
          borderRadius: '6px',
          backgroundColor: '#fff',
          color: '#DC2626',
          fontSize: '12px',
          fontWeight: 700,
          border: 'none',
          cursor: isPending ? 'wait' : 'pointer',
        }}
      >
        {isPending ? '...' : "Arrêter l'impersonation"}
      </button>
    </div>
  )
}

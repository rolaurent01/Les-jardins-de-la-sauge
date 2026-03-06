import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/keep-alive
 * Exécute un SELECT 1 pour empêcher la mise en pause automatique de Supabase
 * (plan gratuit : pause après 7 jours sans activité).
 * Déclenché par cron Vercel tous les jours à 6h UTC.
 */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any).rpc('ping').single()

    // Si la fonction RPC n'existe pas, on fait un fallback sur une requête brute
    if (error) {
      const { error: fallbackError } = await supabase
        .from('varieties')
        .select('id')
        .limit(1)

      if (fallbackError) {
        throw fallbackError
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      message: 'Supabase maintenu actif',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[keep-alive] Échec :', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

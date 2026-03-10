import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncRequestSchema } from '@/lib/validation/sync'
import { userHasFarmAccess } from '@/lib/sync/farm-access'
import { dispatchSyncEntry } from '@/lib/sync/dispatch'

/**
 * POST /api/sync
 *
 * Reçoit UNE saisie mobile et l'insère dans la bonne table via RPC
 * transactionnelle ou INSERT direct. Le uuid_client garantit l'idempotence.
 *
 * Authentification requise + vérification d'accès à la ferme.
 * Le created_by vient du token auth, PAS du payload client.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authentification
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { success: false, uuid_client: null, error: 'Non authentifié' },
      { status: 401 },
    )
  }

  // 2. Parsing et validation du body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, uuid_client: null, error: 'Body JSON invalide' },
      { status: 400 },
    )
  }

  const parsed = syncRequestSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Payload invalide'
    return NextResponse.json(
      { success: false, uuid_client: (body as Record<string, unknown>)?.uuid_client ?? null, error: firstError },
      { status: 400 },
    )
  }

  const { uuid_client, table_cible, farm_id, payload } = parsed.data

  // 3. Validation accès ferme (AVANT tout INSERT/RPC)
  const hasAccess = await userHasFarmAccess(user.id, farm_id)
  if (!hasAccess) {
    return NextResponse.json(
      { success: false, uuid_client, error: 'Accès refusé à cette ferme' },
      { status: 403 },
    )
  }

  // 4. Dispatch vers la bonne table/RPC
  try {
    const result = await dispatchSyncEntry({
      table_cible,
      farm_id,
      user_id: user.id,
      uuid_client,
      payload,
    })

    return NextResponse.json({
      success: true,
      uuid_client,
      server_id: result.server_id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur inattendue'

    // Erreurs RPC métier (stock insuffisant, etc.) → 409
    const isBusinessError = message.includes('stock insuffisant')
      || message.includes('Stock insuffisant')
      || message.includes('insufficient')

    return NextResponse.json(
      { success: false, uuid_client, error: message },
      { status: isBusinessError ? 409 : 500 },
    )
  }
}

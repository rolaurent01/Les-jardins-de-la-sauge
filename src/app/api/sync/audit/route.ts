import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { auditRequestSchema } from '@/lib/validation/sync'
import { userHasFarmAccess } from '@/lib/sync/farm-access'
import { SYNC_TABLES } from '@/lib/validation/sync'

/**
 * POST /api/sync/audit
 *
 * Vérifie qu'une liste de uuid_client sont bien présents en base.
 * Utilisé par le bouton "Tout vérifier 🔍" pour détecter les saisies
 * qui n'auraient pas été synchronisées correctement.
 *
 * Recherche dans TOUTES les tables qui ont uuid_client, filtrées par farm_id.
 * Maximum 200 UUID par appel (pagination côté client).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authentification
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // 2. Parsing et validation du body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const parsed = auditRequestSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Payload invalide'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { uuid_clients, farm_id } = parsed.data

  // 3. Validation accès ferme
  const hasAccess = await userHasFarmAccess(user.id, farm_id)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Accès refusé à cette ferme' }, { status: 403 })
  }

  // 4. Recherche dans toutes les tables en parallèle
  const admin = createAdminClient()
  const foundUuids = new Set<string>()

  const queries = SYNC_TABLES.map(async (table) => {
    const { data, error } = await admin
      .from(table)
      .select('uuid_client')
      .eq('farm_id', farm_id)
      .in('uuid_client', uuid_clients)

    if (error) return // Erreur non bloquante : on continue avec les autres tables

    for (const row of data ?? []) {
      if (row.uuid_client) foundUuids.add(row.uuid_client as string)
    }
  })

  await Promise.all(queries)

  // 5. Calculer confirmed et missing
  const confirmed = uuid_clients.filter((u) => foundUuids.has(u))
  const missing = uuid_clients.filter((u) => !foundUuids.has(u))

  return NextResponse.json({
    confirmed,
    missing,
    total_checked: uuid_clients.length,
  })
}

/**
 * NIVEAU 3 — Tests endpoint sync
 * Teste POST /api/sync et POST /api/sync/audit comme un client mobile.
 * Nécessite que le serveur dev tourne (npm run dev).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TestResult } from './run-integration-tests'

const TEST_PREFIX = '__TEST__'
const BASE_URL = 'http://localhost:3000'

/** Vérifie si le serveur dev est accessible */
async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/sync`, { method: 'OPTIONS' }).catch(() => null)
    // Même un 405 signifie que le serveur répond
    return res !== null
  } catch {
    return false
  }
}

export async function runSyncTests(
  admin: SupabaseClient,
  farmId: string,
  userEmail: string,
  userPassword: string,
): Promise<TestResult[]> {
  const results: TestResult[] = []
  const pass = (name: string) => results.push({ name, passed: true })
  const fail = (name: string, error: string) => results.push({ name, passed: false, error })
  const skip = (name: string) => results.push({ name, passed: true, error: '⏭️ Skipped' })

  // Vérifier que le serveur tourne
  const serverUp = await isServerRunning()
  if (!serverUp) {
    skip('Sync: serveur dev non lancé (npm run dev) — tous les tests sync skippés')
    return results
  }

  // Authentification : obtenir un token pour les requêtes
  const { data: authData, error: authErr } = await admin.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  })

  if (authErr || !authData.session) {
    fail('Sync: authentification', authErr?.message ?? 'Pas de session')
    return results
  }

  const accessToken = authData.session.access_token
  pass('Sync: authentification OK')

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  }

  // Récupérer un rang existant pour les tests
  const { data: existingRow } = await admin.from('rows')
    .select('id, parcel_id')
    .eq('farm_id', farmId)
    .limit(1)
    .single()

  // Récupérer une variété existante
  const { data: existingVariety } = await admin.from('varieties')
    .select('id')
    .limit(1)
    .single()

  if (!existingRow || !existingVariety) {
    fail('Sync: données prérequises', 'Pas de rang ou variété en base')
    return results
  }

  const today = new Date().toISOString().split('T')[0]
  const syncedUuids: string[] = []

  // Helper pour POST /api/sync
  async function syncPost(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
    const res = await fetch(`${BASE_URL}/api/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return { status: res.status, data }
  }

  // ─── Tests par table ───

  // soil_works
  {
    const uuid = crypto.randomUUID()
    const { status, data } = await syncPost({
      uuid_client: uuid,
      table_cible: 'soil_works',
      farm_id: farmId,
      payload: {
        row_id: existingRow.id,
        date: today,
        type_travail: 'depaillage',
        commentaire: `${TEST_PREFIX}sync_soil_work`,
      },
    })
    if (status === 200 && data.success) {
      syncedUuids.push(uuid)
      pass('Sync POST soil_works → 200')
    } else {
      fail('Sync POST soil_works', `status=${status}, error=${data.error}`)
    }
  }

  // row_care
  {
    const uuid = crypto.randomUUID()
    const { status, data } = await syncPost({
      uuid_client: uuid,
      table_cible: 'row_care',
      farm_id: farmId,
      payload: {
        row_id: existingRow.id,
        variety_id: existingVariety.id,
        date: today,
        type_soin: 'desherbage',
        commentaire: `${TEST_PREFIX}sync_row_care`,
      },
    })
    if (status === 200 && data.success) {
      syncedUuids.push(uuid)
      pass('Sync POST row_care → 200')
    } else {
      fail('Sync POST row_care', `status=${status}, error=${data.error}`)
    }
  }

  // harvests (crée du stock)
  let harvestUuid: string | null = null
  {
    const uuid = crypto.randomUUID()
    harvestUuid = uuid
    const { status, data } = await syncPost({
      uuid_client: uuid,
      table_cible: 'harvests',
      farm_id: farmId,
      payload: {
        type_cueillette: 'parcelle',
        row_id: existingRow.id,
        variety_id: existingVariety.id,
        partie_plante: 'feuille',
        date: today,
        poids_g: 100,
        commentaire: `${TEST_PREFIX}sync_harvest`,
      },
    })
    if (status === 200 && data.success) {
      syncedUuids.push(uuid)
      // Vérifier que le stock_movement a été créé
      const { data: sm } = await admin.from('stock_movements')
        .select('id')
        .eq('source_type', 'cueillette')
        .eq('source_id', data.server_id as string)
        .single()
      if (sm) pass('Sync POST harvests → 200 + stock_movement créé')
      else fail('Sync POST harvests', 'stock_movement non créé')
    } else {
      fail('Sync POST harvests', `status=${status}, error=${data.error}`)
    }
  }

  // cuttings (entrée)
  {
    const uuid = crypto.randomUUID()
    const { status, data } = await syncPost({
      uuid_client: uuid,
      table_cible: 'cuttings',
      farm_id: farmId,
      payload: {
        variety_id: existingVariety.id,
        partie_plante: 'feuille',
        type: 'entree',
        date: today,
        poids_g: 100,
        commentaire: `${TEST_PREFIX}sync_cutting`,
      },
    })
    if (status === 200 && data.success) {
      syncedUuids.push(uuid)
      pass('Sync POST cuttings (entree) → 200')
    } else {
      fail('Sync POST cuttings', `status=${status}, error=${data.error}`)
    }
  }

  // stock_purchases
  {
    const uuid = crypto.randomUUID()
    const { status, data } = await syncPost({
      uuid_client: uuid,
      table_cible: 'stock_purchases',
      farm_id: farmId,
      payload: {
        variety_id: existingVariety.id,
        partie_plante: 'feuille',
        date: today,
        etat_plante: 'frais',
        poids_g: 200,
        fournisseur: `${TEST_PREFIX}Fournisseur`,
        certif_ab: false,
        commentaire: `${TEST_PREFIX}sync_purchase`,
      },
    })
    if (status === 200 && data.success) {
      syncedUuids.push(uuid)
      pass('Sync POST stock_purchases → 200')
    } else {
      fail('Sync POST stock_purchases', `status=${status}, error=${data.error}`)
    }
  }

  // seed_lots
  {
    const uuid = crypto.randomUUID()
    const { status, data } = await syncPost({
      uuid_client: uuid,
      table_cible: 'seed_lots',
      farm_id: farmId,
      payload: {
        variety_id: existingVariety.id,
        fournisseur: `${TEST_PREFIX}Fournisseur graines`,
        date_achat: today,
        commentaire: `${TEST_PREFIX}sync_seed_lot`,
      },
    })
    if (status === 200 && data.success) {
      syncedUuids.push(uuid)
      // Vérifier que lot_interne a été auto-généré
      const { data: lot } = await admin.from('seed_lots')
        .select('lot_interne')
        .eq('id', data.server_id as string)
        .single()
      if (lot?.lot_interne && (lot.lot_interne as string).startsWith('SL-')) {
        pass('Sync POST seed_lots → 200 + lot_interne auto-généré')
      } else {
        fail('Sync POST seed_lots', `lot_interne non généré: ${lot?.lot_interne}`)
      }
    } else {
      fail('Sync POST seed_lots', `status=${status}, error=${data.error}`)
    }
  }

  // ─── Test idempotence ───
  if (harvestUuid) {
    const { status, data: data1 } = await syncPost({
      uuid_client: harvestUuid,
      table_cible: 'harvests',
      farm_id: farmId,
      payload: {
        type_cueillette: 'parcelle',
        row_id: existingRow.id,
        variety_id: existingVariety.id,
        partie_plante: 'feuille',
        date: today,
        poids_g: 100,
        commentaire: `${TEST_PREFIX}sync_harvest`,
      },
    })

    if (status === 200 && data1.success) {
      // Vérifier qu'il n'y a pas de doublon
      const { data: harvests } = await admin.from('harvests')
        .select('id')
        .eq('uuid_client', harvestUuid)
      if (harvests && harvests.length === 1) {
        pass('Sync idempotence → même uuid_client, pas de doublon')
      } else {
        fail('Sync idempotence', `${harvests?.length ?? 0} enregistrements au lieu de 1`)
      }
    } else {
      fail('Sync idempotence', `status=${status}, error=${data1.error}`)
    }
  }

  // ─── Tests validation ───

  // farm_id invalide → 403
  {
    const { status } = await syncPost({
      uuid_client: crypto.randomUUID(),
      table_cible: 'soil_works',
      farm_id: '99999999-9999-9999-9999-999999999999',
      payload: { date: today, type_travail: 'depaillage', commentaire: 'test' },
    })
    if (status === 403) pass('Sync validation: farm_id invalide → 403')
    else fail('Sync validation: farm_id invalide', `Attendu 403, reçu ${status}`)
  }

  // table_cible inconnue → 400
  {
    const { status } = await syncPost({
      uuid_client: crypto.randomUUID(),
      table_cible: 'table_inexistante',
      farm_id: farmId,
      payload: { foo: 'bar' },
    })
    if (status === 400) pass('Sync validation: table_cible inconnue → 400')
    else fail('Sync validation: table_cible inconnue', `Attendu 400, reçu ${status}`)
  }

  // payload vide → 400
  {
    const { status } = await syncPost({
      uuid_client: crypto.randomUUID(),
      table_cible: 'soil_works',
      farm_id: farmId,
      payload: {},
    })
    if (status === 400) pass('Sync validation: payload vide → 400')
    else fail('Sync validation: payload vide', `Attendu 400, reçu ${status}`)
  }

  // uuid_client invalide → 400
  {
    const { status } = await syncPost({
      uuid_client: 'pas-un-uuid',
      table_cible: 'soil_works',
      farm_id: farmId,
      payload: { date: today, type_travail: 'depaillage' },
    })
    if (status === 400) pass('Sync validation: uuid_client invalide → 400')
    else fail('Sync validation: uuid_client invalide', `Attendu 400, reçu ${status}`)
  }

  // ─── Test audit ───
  if (syncedUuids.length > 0) {
    // POST /api/sync/audit — vérifier les UUIDs synchronisés
    const auditRes = await fetch(`${BASE_URL}/api/sync/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ uuid_clients: syncedUuids, farm_id: farmId }),
    })
    const auditData = await auditRes.json()

    if (auditRes.status === 200 && auditData.confirmed) {
      const allConfirmed = syncedUuids.every((u: string) => auditData.confirmed.includes(u))
      if (allConfirmed) pass('Sync audit: tous les UUIDs confirmés')
      else fail('Sync audit', `${auditData.confirmed.length}/${syncedUuids.length} confirmés`)
    } else {
      fail('Sync audit', `status=${auditRes.status}`)
    }

    // POST /api/sync/audit avec UUID inventé → marqué missing
    const fakeUuid = crypto.randomUUID()
    const auditRes2 = await fetch(`${BASE_URL}/api/sync/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ uuid_clients: [fakeUuid], farm_id: farmId }),
    })
    const auditData2 = await auditRes2.json()

    if (auditRes2.status === 200 && auditData2.missing?.includes(fakeUuid)) {
      pass('Sync audit: UUID inventé → marqué missing')
    } else {
      fail('Sync audit: UUID inventé', `missing=${JSON.stringify(auditData2.missing)}`)
    }
  }

  return results
}

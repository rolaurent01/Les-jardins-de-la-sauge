/**
 * Script principal — Tests d'intégration LJS
 *
 * Exécute 3 niveaux de tests contre la vraie base Supabase :
 *   1. RLS (permissions)
 *   2. Flux métier (graine → produit fini)
 *   3. Sync (endpoint mobile)
 *
 * Usage : npx tsx src/tests/integration/run-integration-tests.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cleanupTestData } from './cleanup'
import { runRlsTests } from './rls-tests'
import { runFlowTests } from './flow-tests'
import { runSyncTests } from './sync-tests'

// Charger .env.local manuellement (pas de dépendance dotenv)
function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      // Retirer les guillemets encadrants
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Fichier absent — on continue avec les variables d'environnement existantes
  }
}
loadEnvFile(resolve(process.cwd(), '.env.local'))

/** Résultat d'un test individuel */
export type TestResult = {
  name: string
  passed: boolean
  error?: string
}

// ─── Constantes ───
const TEST_FARM_ID = '00000000-0000-0000-0000-000000000002'
const USER_EMAIL = 'rolaurent01@hotmail.com'

// ─── Vérification des variables d'environnement ───
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  process.stderr.write('❌ Variables d\'environnement manquantes :\n')
  if (!supabaseUrl) process.stderr.write('  - NEXT_PUBLIC_SUPABASE_URL\n')
  if (!supabaseAnonKey) process.stderr.write('  - NEXT_PUBLIC_SUPABASE_ANON_KEY\n')
  if (!supabaseServiceKey) process.stderr.write('  - SUPABASE_SERVICE_ROLE_KEY\n')
  process.exit(1)
}

// ─── Clients Supabase ───

// Admin client (bypass RLS) — pour setup/teardown/vérification
const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Fonctions d'affichage ───

function printHeader(title: string) {
  process.stdout.write(`\n${'═'.repeat(50)}\n`)
  process.stdout.write(`  ${title}\n`)
  process.stdout.write(`${'═'.repeat(50)}\n\n`)
}

function printSection(title: string) {
  process.stdout.write(`\n── ${title} ──\n`)
}

function printResults(results: TestResult[]) {
  for (const r of results) {
    if (r.passed) {
      if (r.error?.startsWith('⏭️')) {
        process.stdout.write(`  ⏭️  ${r.name} — ${r.error}\n`)
      } else {
        process.stdout.write(`  ✅ ${r.name}\n`)
      }
    } else {
      process.stdout.write(`  ❌ ${r.name}\n`)
      if (r.error) process.stdout.write(`     → ${r.error}\n`)
    }
  }
}

// ─── Script principal ───

async function main() {
  printHeader('TESTS D\'INTÉGRATION LJS')

  const allResults: TestResult[] = []
  const startTime = Date.now()

  try {
    // 1. Vérifier la connexion admin
    process.stdout.write('Connexion admin (service_role)... ')
    const { data: orgCheck, error: orgErr } = await admin.from('organizations').select('id').limit(1)
    if (orgErr) {
      process.stdout.write('❌\n')
      throw new Error(`Connexion admin échouée: ${orgErr.message}`)
    }
    process.stdout.write('✅\n')

    // 2. Authentifier l'utilisateur pour les tests RLS
    process.stdout.write(`Authentification ${USER_EMAIL}... `)

    // Demander le mot de passe via variable d'environnement
    const userPassword = process.env.TEST_USER_PASSWORD
    if (!userPassword) {
      process.stdout.write('⚠️\n')
      process.stdout.write('  Variable TEST_USER_PASSWORD manquante.\n')
      process.stdout.write('  Usage : TEST_USER_PASSWORD=xxx npx tsx src/tests/integration/run-integration-tests.ts\n')
      process.stdout.write('  Les tests RLS et Sync seront exécutés en mode dégradé (admin uniquement).\n\n')
    }

    let authedClient = admin // fallback : utiliser admin si pas d'auth
    let authOk = false

    if (userPassword) {
      const { data: authData, error: authErr } = await admin.auth.signInWithPassword({
        email: USER_EMAIL,
        password: userPassword,
      })

      if (authErr || !authData.session) {
        process.stdout.write('❌\n')
        process.stdout.write(`  Erreur auth: ${authErr?.message ?? 'Pas de session'}\n`)
        process.stdout.write('  Les tests RLS utiliseront le client admin (mode dégradé).\n\n')
      } else {
        // Créer un client authentifié avec le token de l'utilisateur
        authedClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: { Authorization: `Bearer ${authData.session.access_token}` },
          },
          auth: { autoRefreshToken: false, persistSession: false },
        })
        authOk = true
        process.stdout.write('✅\n')
      }
    }

    // 3. Cleanup préalable (au cas où un run précédent a laissé des données)
    process.stdout.write('\nNettoyage préalable des données __TEST__...\n')
    await cleanupTestData(admin)
    process.stdout.write('OK\n')

    // ═══ NIVEAU 1 — Tests RLS ═══
    printSection('NIVEAU 1 — RLS')
    const rlsResults = await runRlsTests(authedClient, admin, TEST_FARM_ID)
    allResults.push(...rlsResults)
    printResults(rlsResults)

    // ═══ NIVEAU 2 — Tests flux métier ═══
    printSection('NIVEAU 2 — Flux métier')
    const flowResults = await runFlowTests(admin, TEST_FARM_ID)
    allResults.push(...flowResults)
    printResults(flowResults)

    // ═══ NIVEAU 3 — Tests sync ═══
    printSection('NIVEAU 3 — Sync')
    if (userPassword && authOk) {
      const syncResults = await runSyncTests(admin, TEST_FARM_ID, USER_EMAIL, userPassword)
      allResults.push(...syncResults)
      printResults(syncResults)
    } else {
      const skipped: TestResult = {
        name: 'Sync: skippé (TEST_USER_PASSWORD non fourni)',
        passed: true,
        error: '⏭️ Skipped',
      }
      allResults.push(skipped)
      printResults([skipped])
    }

  } finally {
    // 6. Cleanup final (TOUJOURS exécuté)
    process.stdout.write('\n')
    printSection('NETTOYAGE FINAL')
    try {
      await cleanupTestData(admin)
      process.stdout.write('  ✅ Données __TEST__ nettoyées\n')
    } catch (cleanErr) {
      process.stderr.write(`  ❌ Erreur nettoyage: ${cleanErr}\n`)
    }
  }

  // 7. Rapport final
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const passed = allResults.filter((r) => r.passed && !r.error?.startsWith('⏭️')).length
  const skipped = allResults.filter((r) => r.error?.startsWith('⏭️')).length
  const failed = allResults.filter((r) => !r.passed).length
  const total = passed + failed

  printHeader(`RÉSULTAT : ${passed}/${total} tests passés${skipped > 0 ? `, ${skipped} skippés` : ''}${failed > 0 ? `, ${failed} échec(s)` : ''} — ${elapsed}s`)

  if (failed > 0) {
    process.stdout.write('\nÉchecs :\n')
    for (const r of allResults.filter((r) => !r.passed)) {
      process.stdout.write(`  ❌ ${r.name}: ${r.error}\n`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`\n💥 Erreur fatale: ${err}\n`)
  process.exit(1)
})

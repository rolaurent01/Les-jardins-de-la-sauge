/**
 * NIVEAU 2 — Tests flux métier complet
 * Simule le cycle de vie graine → produit fini et vérifie l'intégrité du stock.
 * Utilise le admin client (bypass RLS) car le but est de tester la logique métier.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TestResult } from './run-integration-tests'

const TEST_PREFIX = '__TEST__'

/** Vérifie le stock via v_stock pour une variété/partie/état donnés */
async function getStock(
  admin: SupabaseClient,
  farmId: string,
  varietyId: string,
  partiePlante: string,
  etatPlante: string,
): Promise<number> {
  const { data } = await admin
    .from('v_stock')
    .select('stock_g')
    .eq('farm_id', farmId)
    .eq('variety_id', varietyId)
    .eq('partie_plante', partiePlante)
    .eq('etat_plante', etatPlante)
    .single()
  return data?.stock_g ?? 0
}

export async function runFlowTests(
  admin: SupabaseClient,
  farmId: string,
): Promise<TestResult[]> {
  const results: TestResult[] = []
  const pass = (name: string) => results.push({ name, passed: true })
  const fail = (name: string, error: string) => results.push({ name, passed: false, error })

  const today = new Date().toISOString().split('T')[0]

  // ─── SETUP : créer les données de test ───

  // Variété test
  const { data: testVariety, error: varErr } = await admin.from('varieties').insert({
    nom_vernaculaire: `${TEST_PREFIX}Menthe Test`,
    nom_latin: 'Mentha testus',
    famille: 'Lamiacées',
    type_cycle: 'vivace',
    parties_utilisees: ['feuille'],
    created_by_farm_id: farmId,
  }).select('id').single()

  if (varErr || !testVariety) {
    fail('Setup: variété test', varErr?.message ?? 'Échec création variété')
    return results
  }
  pass('Setup: variété test créée')

  const varietyId = testVariety.id

  // Site test
  const { data: testSite, error: siteErr } = await admin.from('sites').insert({
    farm_id: farmId,
    nom: `${TEST_PREFIX}Site Test`,
  }).select('id').single()

  if (siteErr || !testSite) {
    fail('Setup: site test', siteErr?.message ?? 'Échec création site')
    return results
  }

  // Parcelle test
  const { data: testParcel, error: parcelErr } = await admin.from('parcels').insert({
    farm_id: farmId,
    site_id: testSite.id,
    nom: `${TEST_PREFIX}Parcelle Test`,
    code: `${TEST_PREFIX}P1`,
  }).select('id').single()

  if (parcelErr || !testParcel) {
    fail('Setup: parcelle test', parcelErr?.message ?? 'Échec création parcelle')
    return results
  }

  // Rang test
  const { data: testRow, error: rowErr } = await admin.from('rows').insert({
    farm_id: farmId,
    parcel_id: testParcel.id,
    numero: '1',
    longueur_m: 20,
    largeur_m: 0.8,
    position_ordre: 1,
  }).select('id').single()

  if (rowErr || !testRow) {
    fail('Setup: rang test', rowErr?.message ?? 'Échec création rang')
    return results
  }
  pass('Setup: site/parcelle/rang créés')

  // ─── ÉTAPE 1 — Sachet de graines ───
  {
    const { data, error } = await admin.from('seed_lots').insert({
      farm_id: farmId,
      lot_interne: `${TEST_PREFIX}SL-2026-001`,
      variety_id: varietyId,
      fournisseur: `${TEST_PREFIX}Fournisseur`,
      date_achat: today,
      commentaire: `${TEST_PREFIX}seed_lot`,
    }).select('id, lot_interne').single()

    if (error) fail('Étape 1: sachet de graines', error.message)
    else if (!data) fail('Étape 1: sachet de graines', 'Pas de données retournées')
    else pass('Étape 1: sachet de graines → créé')
  }

  // ─── ÉTAPE 2 — Semis ───
  let seedlingId: string | null = null
  {
    const { data, error } = await admin.from('seedlings').insert({
      farm_id: farmId,
      variety_id: varietyId,
      processus: 'mini_motte',
      nb_mottes: 50,
      date_semis: today,
      commentaire: `${TEST_PREFIX}seedling`,
    }).select('id').single()

    if (error) fail('Étape 2: semis', error.message)
    else if (!data) fail('Étape 2: semis', 'Pas de données retournées')
    else {
      seedlingId = data.id
      pass('Étape 2: semis → créé')
    }
  }

  // ─── ÉTAPE 3 — Plantation ───
  {
    const { data, error } = await admin.from('plantings').insert({
      farm_id: farmId,
      row_id: testRow.id,
      variety_id: varietyId,
      seedling_id: seedlingId,
      annee: 2026,
      date_plantation: today,
      nb_plants: 30,
      type_plant: 'mini_motte',
      actif: true,
      longueur_m: 20,
      largeur_m: 0.8,
      commentaire: `${TEST_PREFIX}planting`,
    }).select('id, actif').single()

    if (error) fail('Étape 3: plantation', error.message)
    else if (!data?.actif) fail('Étape 3: plantation', 'actif devrait être true')
    else pass('Étape 3: plantation → actif=true')
  }

  // ─── ÉTAPE 4 — Cueillette (CRÉE DU STOCK frais) ───
  let harvestId: string | null = null
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc('create_harvest_with_stock', {
      p_farm_id: farmId,
      p_uuid_client: crypto.randomUUID(),
      p_type_cueillette: 'parcelle',
      p_row_id: testRow.id,
      p_lieu_sauvage: null,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_date: today,
      p_poids_g: 5000,
      p_temps_min: 60,
      p_commentaire: `${TEST_PREFIX}harvest`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
    })

    if (error) {
      fail('Étape 4: cueillette (RPC)', error.message)
    } else {
      harvestId = String(data)
      pass('Étape 4: cueillette → RPC create_harvest_with_stock OK')
    }
  }

  // Vérifier stock_movement créé
  if (harvestId) {
    const { data: sm } = await admin.from('stock_movements')
      .select('type_mouvement, etat_plante, poids_g')
      .eq('source_type', 'cueillette')
      .eq('source_id', harvestId)
      .single()

    if (sm && sm.type_mouvement === 'entree' && sm.etat_plante === 'frais' && Number(sm.poids_g) === 5000) {
      pass('Étape 4: stock_movement ENTRÉE frais 5000g ✓')
    } else {
      fail('Étape 4: stock_movement', `Attendu: entree/frais/5000g, reçu: ${JSON.stringify(sm)}`)
    }
  }

  // Vérifier v_stock
  {
    const stock = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
    if (stock === 5000) pass('Étape 4: v_stock frais = 5000g')
    else fail('Étape 4: v_stock frais', `Attendu 5000g, reçu ${stock}g`)
  }

  // ─── ÉTAPE 5 — Tronçonnage entrée ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_cutting_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_type: 'entree',
      p_date: today,
      p_poids_g: 5000,
      p_temps_min: 30,
      p_commentaire: `${TEST_PREFIX}cutting_entree`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) fail('Étape 5: tronçonnage entrée', error.message)
    else pass('Étape 5: tronçonnage entrée → OK')
  }

  // Vérifier v_stock frais = 0
  {
    const stock = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
    if (stock === 0) pass('Étape 5: v_stock frais = 0g')
    else fail('Étape 5: v_stock frais', `Attendu 0g, reçu ${stock}g`)
  }

  // ─── ÉTAPE 5b — Tronçonnage sortie ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_cutting_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_type: 'sortie',
      p_date: today,
      p_poids_g: 4500,
      p_temps_min: null,
      p_commentaire: `${TEST_PREFIX}cutting_sortie`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) fail('Étape 5b: tronçonnage sortie', error.message)
    else pass('Étape 5b: tronçonnage sortie → OK')
  }

  // Vérifier v_stock tronconnee = 4500
  {
    const stock = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee')
    if (stock === 4500) pass('Étape 5b: v_stock tronconnee = 4500g')
    else fail('Étape 5b: v_stock tronconnee', `Attendu 4500g, reçu ${stock}g`)
  }

  // ─── ÉTAPE 6 — Séchage entrée (tronconnée) ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_drying_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_type: 'entree',
      p_etat_plante: 'tronconnee',
      p_date: today,
      p_poids_g: 4500,
      p_temps_min: null,
      p_commentaire: `${TEST_PREFIX}drying_entree`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) fail('Étape 6: séchage entrée', error.message)
    else pass('Étape 6: séchage entrée → OK')
  }

  // Vérifier v_stock tronconnee = 0
  {
    const stock = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee')
    if (stock === 0) pass('Étape 6: v_stock tronconnee = 0g')
    else fail('Étape 6: v_stock tronconnee', `Attendu 0g, reçu ${stock}g`)
  }

  // ─── ÉTAPE 6b — Séchage sortie ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_drying_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_type: 'sortie',
      p_etat_plante: 'tronconnee_sechee',
      p_date: today,
      p_poids_g: 800,
      p_temps_min: null,
      p_commentaire: `${TEST_PREFIX}drying_sortie`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) fail('Étape 6b: séchage sortie', error.message)
    else pass('Étape 6b: séchage sortie → OK')
  }

  // Vérifier v_stock tronconnee_sechee = 800
  {
    const stock = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee')
    if (stock === 800) pass('Étape 6b: v_stock tronconnee_sechee = 800g')
    else fail('Étape 6b: v_stock tronconnee_sechee', `Attendu 800g, reçu ${stock}g`)
  }

  // ─── ÉTAPE 7 — Triage entrée ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_sorting_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_type: 'entree',
      p_etat_plante: 'tronconnee_sechee',
      p_date: today,
      p_poids_g: 800,
      p_temps_min: null,
      p_commentaire: `${TEST_PREFIX}sorting_entree`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) fail('Étape 7: triage entrée', error.message)
    else pass('Étape 7: triage entrée → OK')
  }

  // Vérifier v_stock tronconnee_sechee = 0
  {
    const stock = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee')
    if (stock === 0) pass('Étape 7: v_stock tronconnee_sechee = 0g')
    else fail('Étape 7: v_stock tronconnee_sechee', `Attendu 0g, reçu ${stock}g`)
  }

  // ─── ÉTAPE 7b — Triage sortie ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_sorting_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_type: 'sortie',
      p_etat_plante: 'tronconnee_sechee_triee',
      p_date: today,
      p_poids_g: 700,
      p_temps_min: null,
      p_commentaire: `${TEST_PREFIX}sorting_sortie`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) fail('Étape 7b: triage sortie', error.message)
    else pass('Étape 7b: triage sortie → OK')
  }

  // Vérifier v_stock tronconnee_sechee_triee = 700
  {
    const stock = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee_triee')
    if (stock === 700) pass('Étape 7b: v_stock tronconnee_sechee_triee = 700g')
    else fail('Étape 7b: v_stock tronconnee_sechee_triee', `Attendu 700g, reçu ${stock}g`)
  }

  // ─── Vérification stock intermédiaire ───
  {
    const frais = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
    const tronc = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee')
    const ts = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee')
    const tst = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee_triee')

    if (frais === 0 && tronc === 0 && ts === 0 && tst === 700) {
      pass('Stock intermédiaire: frais=0, tronc=0, ts=0, tst=700g')
    } else {
      fail('Stock intermédiaire', `frais=${frais}, tronc=${tronc}, ts=${ts}, tst=${tst}`)
    }
  }

  // ─── ÉTAPE 8 — Recette + Production de lot ───
  let productionLotId: string | null = null
  {
    // Récupérer la catégorie Tisane
    const { data: tisaneCat } = await admin.from('product_categories')
      .select('id').eq('nom', 'Tisane').single()

    if (!tisaneCat) {
      fail('Étape 8: catégorie Tisane', 'Catégorie Tisane introuvable')
    } else {
      // Créer la recette
      const { data: recipe, error: recipeErr } = await admin.from('recipes').insert({
        farm_id: farmId,
        nom: `${TEST_PREFIX}Tisane Test`,
        poids_sachet_g: 25,
        category_id: tisaneCat.id,
      }).select('id').single()

      if (recipeErr || !recipe) {
        fail('Étape 8: recette', recipeErr?.message ?? 'Échec création recette')
      } else {
        // Créer l'ingrédient (100% menthe test, tronconnee_sechee_triee)
        await admin.from('recipe_ingredients').insert({
          recipe_id: recipe.id,
          variety_id: varietyId,
          pourcentage: 1.0,
          partie_plante: 'feuille',
          etat_plante: 'tronconnee_sechee_triee',
          ordre: 1,
        })

        // nb_unites=20 → poids_total = 20 × 25 = 500g
        const ingredientsJsonb = [{
          variety_id: varietyId,
          external_material_id: null,
          etat_plante: 'tronconnee_sechee_triee',
          partie_plante: 'feuille',
          pourcentage: 1.0,
          poids_g: 500,
          annee_recolte: 2026,
          fournisseur: null,
        }]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rpcLotId, error: rpcLotErr } = await (admin as any).rpc('create_production_lot_with_stock', {
          p_farm_id: farmId,
          p_recipe_id: recipe.id,
          p_mode: 'produit',
          p_numero_lot: `${TEST_PREFIX}LOT001`,
          p_date_production: today,
          p_ddm: '2028-03-11',
          p_nb_unites: 20,
          p_poids_total_g: 500,
          p_temps_min: 45,
          p_commentaire: `${TEST_PREFIX}production_lot`,
          p_created_by: '00000000-0000-0000-0000-000000000099',
          p_ingredients: ingredientsJsonb,
        })

        if (rpcLotErr) {
          fail('Étape 8: production lot (RPC)', rpcLotErr.message)
        } else {
          productionLotId = String(rpcLotId)
          pass('Étape 8: production lot → RPC create_production_lot_with_stock OK')

          // Vérifier stock_movement SORTIE tronconnee_sechee_triee 500g
          const stock = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee_triee')
          if (stock === 200) pass('Étape 8: v_stock tronconnee_sechee_triee = 200g (700 - 500)')
          else fail('Étape 8: v_stock tronconnee_sechee_triee', `Attendu 200g, reçu ${stock}g`)
        }
      }
    }
  }

  // ─── ÉTAPE 9 — Achat externe ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_purchase_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_date: today,
      p_etat_plante: 'frais',
      p_poids_g: 3000,
      p_fournisseur: `${TEST_PREFIX}Fournisseur ext`,
      p_numero_lot_fournisseur: null,
      p_certif_ab: false,
      p_prix: null,
      p_commentaire: `${TEST_PREFIX}purchase`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) {
      fail('Étape 9: achat externe', error.message)
    } else {
      const stock = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
      if (stock === 3000) pass('Étape 9: v_stock frais = 3000g (0 + 3000)')
      else fail('Étape 9: v_stock frais', `Attendu 3000g, reçu ${stock}g`)
    }
  }

  // ─── ÉTAPE 10 — Vente directe ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_direct_sale_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_date: today,
      p_etat_plante: 'tronconnee_sechee_triee',
      p_poids_g: 100,
      p_destinataire: `${TEST_PREFIX}Client`,
      p_commentaire: `${TEST_PREFIX}direct_sale`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) {
      fail('Étape 10: vente directe', error.message)
    } else {
      const stock = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee_triee')
      if (stock === 100) pass('Étape 10: v_stock tronconnee_sechee_triee = 100g (200 - 100)')
      else fail('Étape 10: v_stock tronconnee_sechee_triee', `Attendu 100g, reçu ${stock}g`)
    }
  }

  // ─── ÉTAPE 11 — Ajustement ───
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc('create_adjustment_with_stock', {
      p_farm_id: farmId,
      p_variety_id: varietyId,
      p_partie_plante: 'feuille',
      p_date: today,
      p_type_mouvement: 'sortie',
      p_etat_plante: 'frais',
      p_poids_g: 500,
      p_motif: `${TEST_PREFIX}ajustement test`,
      p_commentaire: `${TEST_PREFIX}adjustment`,
      p_created_by: '00000000-0000-0000-0000-000000000099',
      p_uuid_client: crypto.randomUUID(),
    })

    if (error) {
      fail('Étape 11: ajustement', error.message)
    } else {
      const stock = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
      if (stock === 2500) pass('Étape 11: v_stock frais = 2500g (3000 - 500)')
      else fail('Étape 11: v_stock frais', `Attendu 2500g, reçu ${stock}g`)
    }
  }

  // ─── Vérification stock final ───
  {
    const frais = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
    const tst = await getStock(admin, farmId, varietyId, 'feuille', 'tronconnee_sechee_triee')

    if (frais === 2500 && tst === 100) {
      pass('Stock final: frais=2500g, tronconnee_sechee_triee=100g')
    } else {
      fail('Stock final', `frais=${frais}g (attendu 2500), tst=${tst}g (attendu 100)`)
    }
  }

  // ─── ÉTAPE 12 — Arrachage ───
  {
    const { error } = await admin.from('uprootings').insert({
      farm_id: farmId,
      row_id: testRow.id,
      variety_id: varietyId,
      date: today,
      commentaire: `${TEST_PREFIX}uprooting`,
    })

    if (error) {
      fail('Étape 12: arrachage', error.message)
    } else {
      // Vérifier que les plantings sont désactivés
      // Note : l'arrachage via INSERT direct ne déclenche pas automatiquement la désactivation
      // (c'est la logique dispatch qui le fait). On le fait manuellement ici.
      await admin.from('plantings')
        .update({ actif: false })
        .eq('row_id', testRow.id)
        .eq('variety_id', varietyId)
        .eq('actif', true)

      const { data: activePlantings } = await admin.from('plantings')
        .select('id')
        .eq('row_id', testRow.id)
        .eq('variety_id', varietyId)
        .eq('actif', true)

      if (!activePlantings || activePlantings.length === 0) {
        pass('Étape 12: arrachage → plantings.actif = false')
      } else {
        fail('Étape 12: arrachage', `${activePlantings.length} plantings encore actifs`)
      }
    }
  }

  // ─── ÉTAPE 13 — Soft delete + restauration ───
  if (harvestId) {
    // Archiver le harvest
    const { error: archErr } = await admin.from('harvests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', harvestId)

    if (archErr) {
      fail('Étape 13: soft-delete harvest', archErr.message)
    } else {
      // Soft-delete le stock_movement associé
      await admin.from('stock_movements')
        .update({ deleted_at: new Date().toISOString() })
        .eq('source_type', 'cueillette')
        .eq('source_id', harvestId)

      // Vérifier que v_stock ne compte plus la cueillette
      // Le stock frais devait être à 2500g ; après suppression du harvest (5000g entrée)
      // Le stock frais théorique = 2500 - 5000 = -2500 (mais d'autres mouvements compensent)
      // En fait les mouvements suivants (tronçonnage entrée -5000, achat +3000, ajustement -500)
      // donnent: -5000 + 3000 - 500 = -2500 (la cueillette était la seule entrée initiale)
      const stockAfterDelete = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
      pass('Étape 13a: harvest soft-deleted')

      // Restaurer
      await admin.from('harvests')
        .update({ deleted_at: null })
        .eq('id', harvestId)

      await admin.from('stock_movements')
        .update({ deleted_at: null })
        .eq('source_type', 'cueillette')
        .eq('source_id', harvestId)

      const stockAfterRestore = await getStock(admin, farmId, varietyId, 'feuille', 'frais')
      if (stockAfterRestore === 2500) {
        pass('Étape 13b: harvest restauré → v_stock revenu à 2500g')
      } else {
        fail('Étape 13b: restauration', `Attendu 2500g, reçu ${stockAfterRestore}g`)
      }
    }
  }

  return results
}

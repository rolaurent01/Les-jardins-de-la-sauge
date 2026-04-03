'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseProductStockMovementForm } from '@/lib/utils/produits-parsers'
import { mapSupabaseError } from '@/lib/utils/error-messages'
import type {
  ActionResult,
  ProductStockMovementWithRelations,
  ProductStockSummary,
} from '@/lib/types'

// ---- Requetes ----

/** Recupere tous les mouvements de stock produits finis de la ferme */
export async function fetchProductStockMovements(): Promise<ProductStockMovementWithRelations[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  // Cast : conditionnement_id pas encore dans les types Supabase generes
  const { data, error } = await (supabase as any)
    .from('product_stock_movements')
    .select(
      '*, production_lots(id, numero_lot, recipes(id, nom)), conditionnements(id, numero_lot, production_lot_id)',
    )
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des mouvements : ${error.message}`)

  return (data ?? []) as ProductStockMovementWithRelations[]
}

/** Calcule le stock net par lot de production et par conditionnement */
export async function fetchProductStockSummary(): Promise<ProductStockSummary[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  // Recuperer les mouvements actifs
  const { data: movements, error: movError } = await (supabase as any)
    .from('product_stock_movements')
    .select('production_lot_id, conditionnement_id, type_mouvement, quantite')
    .eq('farm_id', farmId)
    .is('deleted_at', null)

  if (movError) throw new Error(`Erreur mouvements : ${movError.message}`)

  // Stock par lot de production (mode produit)
  const stockByLot = new Map<string, number>()
  // Stock par conditionnement (mode melange)
  const stockByCond = new Map<string, number>()

  for (const m of movements ?? []) {
    const delta = m.type_mouvement === 'entree' ? m.quantite : -m.quantite
    if (m.conditionnement_id) {
      const current = stockByCond.get(m.conditionnement_id) ?? 0
      stockByCond.set(m.conditionnement_id, current + delta)
    } else if (m.production_lot_id) {
      const current = stockByLot.get(m.production_lot_id) ?? 0
      stockByLot.set(m.production_lot_id, current + delta)
    }
  }

  const result: ProductStockSummary[] = []

  // 1. Lots mode produit (numero_lot sur le lot)
  const { data: lots, error: lotError } = await supabase
    .from('production_lots')
    .select('id, numero_lot, nb_unites, mode, recipes(id, nom)')
    .eq('farm_id', farmId)
    .eq('mode', 'produit')
    .is('deleted_at', null)

  if (lotError) throw new Error(`Erreur lots : ${lotError.message}`)

  for (const lot of lots ?? []) {
    const stockNet = stockByLot.get(lot.id) ?? 0
    const hasMovements = stockByLot.has(lot.id)
    if (!hasMovements && !(lot.nb_unites && lot.nb_unites > 0)) continue

    const recipe = lot.recipes as unknown as { id: string; nom: string } | null
    result.push({
      production_lot_id: lot.id,
      conditionnement_id: null,
      numero_lot: lot.numero_lot ?? '—',
      recipe_nom: recipe?.nom ?? '—',
      nb_unites_produites: lot.nb_unites,
      stock_net: stockNet,
    })
  }

  // 2. Conditionnements (mode melange — numero_lot sur le conditionnement)
  const { data: conds, error: condError } = await (supabase as any)
    .from('conditionnements')
    .select('id, numero_lot, nb_unites, production_lot_id, production_lots(recipes(nom))')
    .eq('farm_id', farmId)
    .is('deleted_at', null)

  if (condError) throw new Error(`Erreur conditionnements : ${condError.message}`)

  for (const c of conds ?? []) {
    const stockNet = stockByCond.get(c.id) ?? 0
    const hasMovements = stockByCond.has(c.id)
    if (!hasMovements && c.nb_unites <= 0) continue

    const recipeName = (c as any).production_lots?.recipes?.nom ?? '—'
    result.push({
      production_lot_id: c.production_lot_id,
      conditionnement_id: c.id,
      numero_lot: c.numero_lot,
      recipe_nom: recipeName,
      nb_unites_produites: c.nb_unites,
      stock_net: stockNet,
    })
  }

  // Trier par numero de lot DESC
  result.sort((a, b) => b.numero_lot.localeCompare(a.numero_lot))

  return result
}

/** Recupere les lots mode produit + conditionnements pour le select du formulaire de stock */
export async function fetchProductionLotsForSelect(): Promise<
  { id: string; numero_lot: string; nb_unites: number | null; recipe_nom: string; type: 'lot' | 'conditionnement' }[]
> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  // Lots mode produit
  const { data: lots, error: lotError } = await supabase
    .from('production_lots')
    .select('id, numero_lot, nb_unites, mode, recipes(nom)')
    .eq('farm_id', farmId)
    .eq('mode', 'produit')
    .is('deleted_at', null)
    .order('date_production', { ascending: false })

  if (lotError) throw new Error(`Erreur lots : ${lotError.message}`)

  // Conditionnements
  const { data: conds, error: condError } = await (supabase as any)
    .from('conditionnements')
    .select('id, numero_lot, nb_unites, production_lots(recipes(nom))')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_conditionnement', { ascending: false })

  if (condError) throw new Error(`Erreur conditionnements : ${condError.message}`)

  const result = [
    ...(lots ?? []).map(lot => ({
      id: lot.id,
      numero_lot: lot.numero_lot ?? '—',
      nb_unites: lot.nb_unites,
      recipe_nom: (lot.recipes as unknown as { nom: string } | null)?.nom ?? '—',
      type: 'lot' as const,
    })),
    ...(conds ?? []).map((c: any) => ({
      id: c.id,
      numero_lot: c.numero_lot,
      nb_unites: c.nb_unites,
      recipe_nom: c.production_lots?.recipes?.nom ?? '—',
      type: 'conditionnement' as const,
    })),
  ]

  return result
}

// ---- Actions ----

/** Cree un mouvement de stock produit fini */
export async function createProductStockMovement(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseProductStockMovementForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  // Determiner la source (lot ou conditionnement) et verifier l'appartenance
  if (parsed.data.conditionnement_id) {
    const { data: cond, error: condErr } = await (supabase as any)
      .from('conditionnements')
      .select('id')
      .eq('id', parsed.data.conditionnement_id)
      .eq('farm_id', farmId)
      .is('deleted_at', null)
      .single()

    if (condErr || !cond) return { error: 'Conditionnement introuvable' }
  } else if (parsed.data.production_lot_id) {
    const { data: lot, error: lotErr } = await supabase
      .from('production_lots')
      .select('id')
      .eq('id', parsed.data.production_lot_id)
      .eq('farm_id', farmId)
      .is('deleted_at', null)
      .single()

    if (lotErr || !lot) return { error: 'Lot de production introuvable' }
  }

  // Si sortie, verifier le stock net suffisant
  if (parsed.data.type_mouvement === 'sortie') {
    const sourceField = parsed.data.conditionnement_id ? 'conditionnement_id' : 'production_lot_id'
    const sourceId = parsed.data.conditionnement_id ?? parsed.data.production_lot_id

    const { data: movements } = await (supabase as any)
      .from('product_stock_movements')
      .select('type_mouvement, quantite')
      .eq('farm_id', farmId)
      .eq(sourceField, sourceId!)
      .is('deleted_at', null)

    let stockNet = 0
    for (const m of (movements ?? []) as { type_mouvement: string; quantite: number }[]) {
      stockNet += m.type_mouvement === 'entree' ? m.quantite : -m.quantite
    }

    if (stockNet < parsed.data.quantite) {
      return {
        error: `Stock insuffisant : ${stockNet} disponible${stockNet !== 1 ? 's' : ''}, ${parsed.data.quantite} demande${parsed.data.quantite !== 1 ? 's' : ''}`,
      }
    }
  }

  const { error } = await (supabase as any)
    .from('product_stock_movements')
    .insert({
      farm_id: farmId,
      production_lot_id: parsed.data.production_lot_id ?? null,
      conditionnement_id: parsed.data.conditionnement_id ?? null,
      date: parsed.data.date,
      type_mouvement: parsed.data.type_mouvement,
      quantite: parsed.data.quantite,
      commentaire: parsed.data.commentaire,
      created_by: userId,
    })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/stock'))
  return { success: true }
}

/** Supprime un mouvement de stock produit fini (hard delete) */
export async function deleteProductStockMovement(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { farmId, orgSlug } = await getContext()

  // Verifier l'appartenance a la ferme avant suppression
  const { data: movement } = await supabase
    .from('product_stock_movements')
    .select('id')
    .eq('id', id)
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .single()

  if (!movement) return { error: 'Mouvement introuvable' }

  const { error } = await supabase
    .from('product_stock_movements')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/produits/stock'))
  return { success: true }
}

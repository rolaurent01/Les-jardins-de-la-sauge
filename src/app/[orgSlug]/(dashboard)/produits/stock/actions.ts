'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseProductStockMovementForm } from '@/lib/utils/produits-parsers'
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

  const { data, error } = await supabase
    .from('product_stock_movements')
    .select(
      '*, production_lots(id, numero_lot, recipes(id, nom))',
    )
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des mouvements : ${error.message}`)

  return (data ?? []) as unknown as ProductStockMovementWithRelations[]
}

/** Calcule le stock net par lot de production */
export async function fetchProductStockSummary(): Promise<ProductStockSummary[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  // Recuperer les mouvements actifs groupes par lot
  const { data: movements, error: movError } = await supabase
    .from('product_stock_movements')
    .select('production_lot_id, type_mouvement, quantite')
    .eq('farm_id', farmId)
    .is('deleted_at', null)

  if (movError) throw new Error(`Erreur mouvements : ${movError.message}`)

  // Calculer le stock net par lot
  const stockByLot = new Map<string, number>()
  for (const m of movements ?? []) {
    if (!m.production_lot_id) continue
    const current = stockByLot.get(m.production_lot_id) ?? 0
    const delta = m.type_mouvement === 'entree' ? m.quantite : -m.quantite
    stockByLot.set(m.production_lot_id, current + delta)
  }

  // Recuperer les infos des lots concernes + lots avec nb_unites > 0
  const { data: lots, error: lotError } = await supabase
    .from('production_lots')
    .select('id, numero_lot, nb_unites, recipes(id, nom)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)

  if (lotError) throw new Error(`Erreur lots : ${lotError.message}`)

  const result: ProductStockSummary[] = []
  for (const lot of lots ?? []) {
    const stockNet = stockByLot.get(lot.id) ?? 0
    const hasMovements = stockByLot.has(lot.id)
    // Afficher seulement les lots avec au moins un mouvement OU nb_unites > 0
    if (!hasMovements && !(lot.nb_unites && lot.nb_unites > 0)) continue

    const recipe = lot.recipes as unknown as { id: string; nom: string } | null
    result.push({
      production_lot_id: lot.id,
      numero_lot: lot.numero_lot,
      recipe_nom: recipe?.nom ?? '—',
      nb_unites_produites: lot.nb_unites,
      stock_net: stockNet,
    })
  }

  // Trier par numero de lot DESC (les plus recents en premier)
  result.sort((a, b) => b.numero_lot.localeCompare(a.numero_lot))

  return result
}

/** Recupere les lots de production actifs pour le select du formulaire */
export async function fetchProductionLotsForSelect(): Promise<
  { id: string; numero_lot: string; nb_unites: number | null; recipe_nom: string }[]
> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('production_lots')
    .select('id, numero_lot, nb_unites, recipes(nom)')
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .order('date_production', { ascending: false })

  if (error) throw new Error(`Erreur lots : ${error.message}`)

  return (data ?? []).map(lot => ({
    id: lot.id,
    numero_lot: lot.numero_lot,
    nb_unites: lot.nb_unites,
    recipe_nom: (lot.recipes as unknown as { nom: string } | null)?.nom ?? '—',
  }))
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

  // Verifier que le lot appartient a la ferme
  const { data: lot, error: lotErr } = await supabase
    .from('production_lots')
    .select('id')
    .eq('id', parsed.data.production_lot_id)
    .eq('farm_id', farmId)
    .is('deleted_at', null)
    .single()

  if (lotErr || !lot) return { error: 'Lot de production introuvable' }

  // Si sortie, verifier le stock net suffisant
  if (parsed.data.type_mouvement === 'sortie') {
    const { data: movements } = await supabase
      .from('product_stock_movements')
      .select('type_mouvement, quantite')
      .eq('farm_id', farmId)
      .eq('production_lot_id', parsed.data.production_lot_id)
      .is('deleted_at', null)

    let stockNet = 0
    for (const m of movements ?? []) {
      stockNet += m.type_mouvement === 'entree' ? m.quantite : -m.quantite
    }

    if (stockNet < parsed.data.quantite) {
      return {
        error: `Stock insuffisant : ${stockNet} sachet${stockNet !== 1 ? 's' : ''} disponible${stockNet !== 1 ? 's' : ''}, ${parsed.data.quantite} demande${parsed.data.quantite !== 1 ? 's' : ''}`,
      }
    }
  }

  const { error } = await supabase
    .from('product_stock_movements')
    .insert({
      farm_id: farmId,
      production_lot_id: parsed.data.production_lot_id,
      date: parsed.data.date,
      type_mouvement: parsed.data.type_mouvement,
      quantite: parsed.data.quantite,
      commentaire: parsed.data.commentaire,
      created_by: userId,
    })

  if (error) return { error: `Erreur : ${error.message}` }

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

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath(buildPath(orgSlug, '/produits/stock'))
  return { success: true }
}

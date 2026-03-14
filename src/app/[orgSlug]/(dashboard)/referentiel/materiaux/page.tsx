import { createClient } from '@/lib/supabase/server'
import type { ExternalMaterial } from '@/lib/types'
import MateriauxClient from '@/components/referentiel/MateriauxClient'

export const metadata = { title: 'Produits complémentaires — Carnet Culture' }

export default async function MateriauxPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('external_materials')
    .select('*')
    .order('nom')

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement des matériaux : {error.message}
        </p>
      </div>
    )
  }

  return <MateriauxClient initialMaterials={(data as ExternalMaterial[]) ?? []} />
}

import { createClient } from '@/lib/supabase/server'
import type { Variety } from '@/lib/types'
import VarietesClient from '@/components/referentiel/VarietesClient'

export const metadata = { title: 'Variétés — LJS' }

export default async function VarietesPage() {
  const supabase = await createClient()

  // Charge actives + archivées — le tri client-side gère la séparation
  const { data, error } = await supabase
    .from('varieties')
    .select('*')
    .order('nom_vernaculaire')

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement des variétés : {error.message}
        </p>
      </div>
    )
  }

  return <VarietesClient initialVarieties={(data as Variety[]) ?? []} />
}

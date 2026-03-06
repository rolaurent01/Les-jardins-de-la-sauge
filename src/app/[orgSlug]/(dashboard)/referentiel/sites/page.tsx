import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'
import type { Site, ParcelWithSite, RowWithParcel } from '@/lib/types'
import SitesParcelsClient from '@/components/referentiel/SitesParcelsClient'

export const metadata = { title: 'Sites & Parcelles — LJS' }

export default async function SitesPage() {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const [sitesRes, parcelsRes, rowsRes] = await Promise.all([
    supabase.from('sites').select('*').eq('farm_id', farmId).order('nom'),
    supabase.from('parcels').select('*, sites(id, nom)').eq('farm_id', farmId).order('code'),
    supabase
      .from('rows')
      .select('*, parcels(id, nom, code, sites(id, nom))')
      .eq('farm_id', farmId)
      .order('parcel_id')
      .order('numero'),
  ])

  const loadError = sitesRes.error?.message ?? parcelsRes.error?.message ?? rowsRes.error?.message
  if (loadError) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: '#BC6C25' }}>
          Erreur lors du chargement : {loadError}
        </p>
      </div>
    )
  }

  return (
    <SitesParcelsClient
      initialSites={(sitesRes.data as Site[]) ?? []}
      initialParcels={(parcelsRes.data as ParcelWithSite[]) ?? []}
      initialRows={(rowsRes.data as RowWithParcel[]) ?? []}
    />
  )
}

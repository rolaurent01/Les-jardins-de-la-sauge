'use client'

import { useRouter } from 'next/navigation'

type Organization = {
  slug: string
  nom: string
}

type Props = {
  organizations: Organization[]
  activeOrgSlug: string
}

/**
 * Sélecteur d'organisation — visible uniquement pour les platform_admins.
 * Permet au super admin de basculer entre toutes les organisations.
 * Redirige vers /{orgSlug}/dashboard et reset le cookie active_farm_id.
 */
export default function OrgSwitcher({ organizations, activeOrgSlug }: Props) {
  const router = useRouter()

  // Pas de sélecteur si une seule org ou aucune
  if (organizations.length <= 1) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSlug = e.target.value
    if (newSlug === activeOrgSlug) return

    // Supprimer le cookie active_farm_id pour que le layout résolve la première ferme de la nouvelle org
    document.cookie = 'active_farm_id=; path=/; max-age=0; samesite=lax'
    router.push(`/${newSlug}/dashboard`)
  }

  return (
    <div className="px-3 py-1.5">
      <label className="sr-only" htmlFor="org-switcher">
        Organisation
      </label>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: '12px', opacity: 0.6 }}>🏢</span>
        <select
          id="org-switcher"
          value={activeOrgSlug}
          onChange={handleChange}
          className="flex-1 text-[12px] rounded-md px-2 py-1 outline-none cursor-pointer"
          style={{
            backgroundColor: 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          {organizations.map(org => (
            <option
              key={org.slug}
              value={org.slug}
              style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
            >
              {org.nom}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

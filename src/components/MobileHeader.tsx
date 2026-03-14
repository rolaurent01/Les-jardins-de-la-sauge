'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/app/login/actions'

/* ============================================================
   Barre de navigation mobile — visible uniquement sur mobile (< md)
   Contient : brand, hamburger, drawer de navigation
   ============================================================ */

type NavChild = { label: string; href: string }
type NavSection = {
  id: string
  label: string
  emoji: string
  children: NavChild[]
  disabled?: boolean
  phaseLabel?: string
}

/** Chemins relatifs — préfixés avec /{orgSlug} au rendu via h() */
const NAV: NavSection[] = [
  {
    id: 'referentiel',
    label: 'Référentiel',
    emoji: '⚙️',
    children: [
      { label: 'Variétés', href: '/referentiel/varietes' },
      { label: 'Sites & Parcelles', href: '/referentiel/sites' },
      { label: 'Produits complémentaires', href: '/referentiel/materiaux' },
    ],
  },
  {
    id: 'semis',
    label: 'Semis',
    emoji: '🌱',
    children: [
      { label: 'Sachets de graines', href: '/semis/sachets' },
      { label: 'Suivi semis', href: '/semis/suivi' },
    ],
  },
  {
    id: 'parcelles',
    label: 'Suivi parcelle',
    emoji: '🌿',
    children: [
      { label: 'Travail de sol', href: '/parcelles/travail-sol' },
      { label: 'Plantation', href: '/parcelles/plantation' },
      { label: 'Suivi de rang', href: '/parcelles/suivi-rang' },
      { label: 'Cueillette', href: '/parcelles/cueillette' },
      { label: 'Arrachage', href: '/parcelles/arrachage' },
      { label: 'Occultation', href: '/parcelles/occultation' },
    ],
  },
  {
    id: 'transformation',
    label: 'Transformation',
    emoji: '🔄',
    children: [
      { label: 'Tronçonnage', href: '/transformation/tronconnage' },
      { label: 'Séchage', href: '/transformation/sechage' },
      { label: 'Triage', href: '/transformation/triage' },
    ],
  },
  {
    id: 'produits',
    label: 'Création de produit',
    emoji: '🧪',
    children: [
      { label: 'Recettes', href: '/produits/recettes' },
      { label: 'Production de lots', href: '/produits/production' },
      { label: 'Stock produits finis', href: '/produits/stock' },
    ],
  },
  {
    id: 'stock',
    label: 'Affinage du stock',
    emoji: '📦',
    children: [
      { label: 'Achats', href: '/stock/achats' },
      { label: 'Ventes directes', href: '/stock/ventes' },
      { label: 'Ajustements', href: '/stock/ajustements' },
    ],
  },
]

type MobileHeaderProps = {
  userEmail?: string
  organization: { nom_affiche: string | null; logo_url: string | null }
  farms: { id: string; nom: string; certif_bio?: boolean }[]
  activeFarmId: string
  orgSlug: string
}

export default function MobileHeader({ userEmail, organization, orgSlug }: MobileHeaderProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openSections, setOpenSections] = useState<string[]>(['referentiel'])

  const displayName = organization.nom_affiche ?? 'Mon Jardin'

  /** Construit le chemin absolu avec le préfixe orgSlug */
  function h(path: string) {
    return `/${orgSlug}${path}`
  }

  const dashboardHref = h('/dashboard')

  function toggleSection(id: string) {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  return (
    <>
      {/* ---- Barre top ---- */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b"
        style={{ backgroundColor: 'var(--color-primary)', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        {/* Brand */}
        <Link href={dashboardHref} className="flex items-center gap-2.5" onClick={() => setDrawerOpen(false)}>
          {organization.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logo_url}
              alt={displayName}
              className="w-8 h-8 rounded-full object-contain"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
              style={{ backgroundColor: 'var(--color-primary-light)', fontSize: '14px' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-white text-[14px] font-semibold tracking-tight leading-tight truncate max-w-[160px]">
            {displayName}
          </span>
        </Link>

        {/* Bouton hamburger */}
        <button
          onClick={() => setDrawerOpen(prev => !prev)}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
          style={{ color: '#C4D4C5' }}
          aria-label={drawerOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {drawerOpen ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </header>

      {/* ---- Overlay ---- */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ---- Drawer navigation ---- */}
      <div
        className="fixed top-14 right-0 bottom-0 z-30 w-72 overflow-y-auto flex flex-col transition-transform duration-300"
        style={{
          backgroundColor: 'var(--color-primary)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Lien Dashboard */}
        <div className="px-3 pt-3">
          <Link
            href={dashboardHref}
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
            style={{
              color: pathname === dashboardHref ? '#F9F8F6' : '#C4D4C5',
              backgroundColor: pathname === dashboardHref ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontWeight: pathname === dashboardHref ? 600 : 400,
            }}
          >
            <span>☀️</span>
            <span>Dashboard</span>
          </Link>
        </div>

        <div className="mx-3 mt-2 mb-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

        {/* Navigation sections */}
        <nav className="flex-1 px-3 pb-2 space-y-0.5">
          {NAV.map(section => {
            const isOpen = openSections.includes(section.id)
            const hasActiveChild = section.children.some(c => pathname.startsWith(h(c.href)))

            return (
              <div key={section.id}>
                <button
                  onClick={() => !section.disabled && toggleSection(section.id)}
                  disabled={section.disabled}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left"
                  style={{
                    color: section.disabled
                      ? 'rgba(255,255,255,0.25)'
                      : hasActiveChild
                      ? '#F9F8F6'
                      : '#C4D4C5',
                    backgroundColor: hasActiveChild && !isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                    cursor: section.disabled ? 'default' : 'pointer',
                    fontWeight: hasActiveChild ? 600 : 400,
                  }}
                >
                  <span className="text-base leading-none w-5 text-center flex-shrink-0">{section.emoji}</span>
                  <span className="flex-1 truncate">{section.label}</span>
                  {section.phaseLabel && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}
                    >
                      {section.phaseLabel}
                    </span>
                  )}
                  {!section.disabled && section.children.length > 0 && (
                    <span
                      className="text-xs flex-shrink-0 transition-transform"
                      style={{
                        color: 'rgba(255,255,255,0.35)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▾
                    </span>
                  )}
                </button>

                {isOpen && !section.disabled && section.children.length > 0 && (
                  <div
                    className="mt-0.5 mb-1 ml-3 pl-3 space-y-0.5"
                    style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {section.children.map(child => {
                      const childHref = h(child.href)
                      const isActive = pathname.startsWith(childHref)
                      return (
                        <Link
                          key={child.href}
                          href={childHref}
                          onClick={() => setDrawerOpen(false)}
                          className="flex items-center px-2 py-2 rounded-lg text-sm"
                          style={{
                            color: isActive ? '#F9F8F6' : '#A8BFA9',
                            backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Lien Mode terrain */}
        <div className="px-3 pb-1">
          <Link
            href={h('/m/saisie')}
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
            style={{ color: '#A8BFA9' }}
          >
            <span className="text-base leading-none w-5 text-center flex-shrink-0">📱</span>
            <span>Mode terrain</span>
          </Link>
        </div>

        {/* Pied : email + déconnexion */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {userEmail && (
            <div
              className="text-xs px-3 py-1.5 mb-2 truncate"
              style={{ color: '#8FAD88' }}
              title={userEmail}
            >
              {userEmail}
            </div>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left"
              style={{ color: '#A8BFA9' }}
            >
              <span>↪</span>
              <span>Déconnexion</span>
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

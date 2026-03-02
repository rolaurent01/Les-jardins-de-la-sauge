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
      { label: 'Production de lots', href: '/produits/lots' },
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
  {
    id: 'miel',
    label: 'Miel',
    emoji: '🍯',
    disabled: true,
    phaseLabel: 'Phase C',
    children: [],
  },
]

export default function MobileHeader({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openSections, setOpenSections] = useState<string[]>(['referentiel'])

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
        style={{ backgroundColor: '#3A5A40', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setDrawerOpen(false)}>
          <div className="w-8 h-8 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden="true">
              <path
                d="M12.5 12.2c2.2-4.3 6.2-6 8.5-6.2-.2 2.3-1.9 6.3-6.2 8.5-1.1.6-2.4.9-3.7.9.4-1.1.8-2.2 1.4-3.2Z"
                fill="rgba(157,186,138,0.95)"
              />
              <path
                d="M11.5 12.2C9.3 7.9 5.3 6.2 3 6c.2 2.3 1.9 6.3 6.2 8.5 1.1.6 2.4.9 3.7.9-.4-1.1-.8-2.2-1.4-3.2Z"
                fill="rgba(157,186,138,0.75)"
              />
              <path
                d="M12 21c0-3.5 0-6.2 1.2-8.6"
                stroke="rgba(157,186,138,0.9)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-white text-[14px] font-semibold tracking-tight leading-tight">
            Les Jardins de la Sauge
          </span>
        </Link>

        {/* Bouton hamburger */}
        <button
          onClick={() => setDrawerOpen(prev => !prev)}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: '#C4D4C5' }}
          aria-label={drawerOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {drawerOpen ? (
            /* Icône × */
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            /* Icône hamburger */
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
          backgroundColor: '#3A5A40',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Lien Dashboard */}
        <div className="px-3 pt-3">
          <Link
            href="/dashboard"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
            style={{
              color: pathname === '/dashboard' ? '#F9F8F6' : '#C4D4C5',
              backgroundColor: pathname === '/dashboard' ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontWeight: pathname === '/dashboard' ? 600 : 400,
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
            const hasActiveChild = section.children.some(c => pathname.startsWith(c.href))

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
                      const isActive = pathname.startsWith(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
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

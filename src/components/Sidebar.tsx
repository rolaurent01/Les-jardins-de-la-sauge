'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/app/login/actions'

/* ============================================================
   Définition de la navigation
   Ordre : Référentiel d'abord (Phase A), puis les 5 modules métier, puis Miel (Phase C)
   ============================================================ */
type NavChild = { label: string; href: string }
type NavSection = {
  id: string
  label: string
  emoji: string
  children: NavChild[]
  disabled?: boolean
  badge?: string
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
      { label: 'Matériaux externes', href: '/referentiel/materiaux' },
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

/* ============================================================
   Composant
   ============================================================ */
export default function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname()

  // Sections ouvertes par défaut : celle qui contient la page active
  const initialOpen = NAV.filter(section =>
    section.children.some(child => pathname.startsWith(child.href))
  ).map(s => s.id)
  // Toujours ouvrir Référentiel par défaut si aucune section active
  const [openSections, setOpenSections] = useState<string[]>(
    initialOpen.length > 0 ? initialOpen : ['referentiel']
  )

  function toggleSection(id: string) {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  return (
    <aside
      className="flex flex-col h-screen w-60 flex-shrink-0 overflow-y-auto"
      style={{ backgroundColor: '#3A5A40' }}
    >
      {/* ---- En-tête ---- */}
      <div
        className="px-4 py-5 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="text-2xl leading-none">🌿</span>
        <div>
          <div className="text-sm font-semibold leading-tight" style={{ color: '#F9F8F6' }}>
            Les Jardins
          </div>
          <div className="text-xs leading-tight" style={{ color: '#8FAD88' }}>
            de la Sauge
          </div>
        </div>
      </div>

      {/* ---- Lien Dashboard ---- */}
      <div className="px-3 pt-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
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

      {/* ---- Séparateur ---- */}
      <div className="mx-3 mt-3 mb-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      {/* ---- Navigation ---- */}
      <nav className="flex-1 px-3 pb-2 space-y-0.5">
        {NAV.map(section => {
          const isOpen = openSections.includes(section.id)
          const hasActiveChild = section.children.some(c => pathname.startsWith(c.href))

          return (
            <div key={section.id}>
              {/* En-tête de section */}
              <button
                onClick={() => !section.disabled && toggleSection(section.id)}
                disabled={section.disabled}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                style={{
                  color: section.disabled
                    ? 'rgba(255,255,255,0.25)'
                    : hasActiveChild
                    ? '#F9F8F6'
                    : '#C4D4C5',
                  backgroundColor: hasActiveChild && !isOpen
                    ? 'rgba(255,255,255,0.08)'
                    : 'transparent',
                  cursor: section.disabled ? 'default' : 'pointer',
                  fontWeight: hasActiveChild ? 600 : 400,
                }}
              >
                <span className="text-base leading-none w-5 text-center flex-shrink-0">
                  {section.emoji}
                </span>
                <span className="flex-1 truncate">{section.label}</span>
                {section.phaseLabel && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.3)',
                    }}
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

              {/* Enfants */}
              {isOpen && !section.disabled && section.children.length > 0 && (
                <div className="mt-0.5 mb-1 ml-3 pl-3 space-y-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  {section.children.map(child => {
                    const isActive = pathname.startsWith(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex items-center px-2 py-1.5 rounded-lg text-sm transition-colors"
                        style={{
                          color: isActive ? '#F9F8F6' : '#A8BFA9',
                          backgroundColor: isActive
                            ? 'rgba(255,255,255,0.12)'
                            : 'transparent',
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

      {/* ---- Pied : utilisateur + déconnexion ---- */}
      <div
        className="px-3 py-3 mt-auto"
        style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
      >
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
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{ color: '#A8BFA9' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.08)'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#F9F8F6'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#A8BFA9'
            }}
          >
            <span>↪</span>
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  )
}

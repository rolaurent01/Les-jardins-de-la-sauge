'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/app/login/actions'

/* ============================================================
   Tokens de design — système de couleurs sidebar
   ============================================================ */
const C = {
  // Fonds
  activeBg:  'rgba(255,255,255,0.09)',
  hoverBg:   'rgba(255,255,255,0.05)',
  openBg:    'rgba(255,255,255,0.04)',
  // Textes
  activeText: '#EDF5EE',
  normalText: '#87A888',
  hoverText:  '#BBCFBC',
  disabled:   'rgba(255,255,255,0.2)',
  // Sous-items
  subActive:  '#CEE9CE',
  subNormal:  '#6E9270',
  subHover:   '#96B897',
  // Barre indicatrice
  activeBar: '#7CC47C',
  // Structurel
  divider:    'rgba(255,255,255,0.07)',
  indentLine: 'rgba(255,255,255,0.08)',
  chevron:    'rgba(255,255,255,0.3)',
  // Footer
  footerEmail: '#638064',
  // Badges
  phaseBg:   'rgba(255,255,255,0.07)',
  phaseText: 'rgba(255,255,255,0.3)',
} as const

const TRANSITION = 'background-color 150ms ease, color 150ms ease'

/* ============================================================
   BrandHeader — compact, style app SaaS
   ============================================================ */
function BrandHeader() {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-[13px] flex-shrink-0"
      style={{ borderBottom: `1px solid ${C.divider}` }}
    >
      {/* Icône dans un carré arrondi */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
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

      {/* Texte marque */}
      <div className="leading-tight min-w-0">
        <p
          className="text-[13px] font-semibold tracking-tight truncate"
          style={{ color: '#EDF5EE' }}
        >
          Les Jardins
        </p>
        <p
          className="text-[11px] tracking-tight truncate"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          de la Sauge
        </p>
      </div>
    </div>
  )
}

/* ============================================================
   ActiveBar — barre verticale indicatrice d'item actif
   ============================================================ */
function ActiveBar({ visible }: { visible: boolean }) {
  return (
    <div
      className="absolute left-0 top-[5px] bottom-[5px] rounded-full"
      style={{
        width: '2px',
        backgroundColor: C.activeBar,
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
    />
  )
}

/* ============================================================
   Définition de la navigation
   ============================================================ */
type NavChild   = { label: string; href: string }
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
      { label: 'Variétés',           href: '/referentiel/varietes'  },
      { label: 'Sites & Parcelles',  href: '/referentiel/sites'     },
      { label: 'Matériaux externes', href: '/referentiel/materiaux' },
    ],
  },
  {
    id: 'semis',
    label: 'Semis',
    emoji: '🌱',
    children: [
      { label: 'Sachets de graines', href: '/semis/sachets' },
      { label: 'Suivi semis',        href: '/semis/suivi'   },
    ],
  },
  {
    id: 'parcelles',
    label: 'Suivi parcelle',
    emoji: '🌿',
    children: [
      { label: 'Travail de sol', href: '/parcelles/travail-sol'  },
      { label: 'Plantation',     href: '/parcelles/plantation'   },
      { label: 'Suivi de rang',  href: '/parcelles/suivi-rang'   },
      { label: 'Cueillette',     href: '/parcelles/cueillette'   },
      { label: 'Arrachage',      href: '/parcelles/arrachage'    },
    ],
  },
  {
    id: 'transformation',
    label: 'Transformation',
    emoji: '🔄',
    children: [
      { label: 'Tronçonnage', href: '/transformation/tronconnage' },
      { label: 'Séchage',     href: '/transformation/sechage'     },
      { label: 'Triage',      href: '/transformation/triage'      },
    ],
  },
  {
    id: 'produits',
    label: 'Création de produit',
    emoji: '🧪',
    children: [
      { label: 'Recettes',            href: '/produits/recettes' },
      { label: 'Production de lots',  href: '/produits/lots'     },
      { label: 'Stock produits finis', href: '/produits/stock'   },
    ],
  },
  {
    id: 'stock',
    label: 'Affinage du stock',
    emoji: '📦',
    children: [
      { label: 'Achats',        href: '/stock/achats'       },
      { label: 'Ventes directes', href: '/stock/ventes'     },
      { label: 'Ajustements',   href: '/stock/ajustements'  },
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
   Composant principal
   ============================================================ */
export default function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname()

  const initialOpen = NAV.filter(section =>
    section.children.some(child => pathname.startsWith(child.href))
  ).map(s => s.id)

  const [openSections, setOpenSections] = useState<string[]>(
    initialOpen.length > 0 ? initialOpen : ['referentiel']
  )

  function toggleSection(id: string) {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const isDashActive = pathname === '/dashboard'

  return (
    <aside
      className="flex flex-col h-screen w-60 flex-shrink-0 overflow-y-auto"
      style={{ backgroundColor: '#3A5A40' }}
    >
      {/* ---- En-tête ---- */}
      <BrandHeader />

      {/* ---- Lien Dashboard ---- */}
      <div className="px-2 pt-2 pb-1">
        <div className="relative">
          <ActiveBar visible={isDashActive} />
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] select-none"
            style={{
              color:           isDashActive ? C.activeText : C.normalText,
              backgroundColor: isDashActive ? C.activeBg   : 'transparent',
              fontWeight:      isDashActive ? 500 : 400,
              transition:      TRANSITION,
            }}
            onMouseEnter={e => {
              if (!isDashActive) {
                e.currentTarget.style.backgroundColor = C.hoverBg
                e.currentTarget.style.color = C.hoverText
              }
            }}
            onMouseLeave={e => {
              if (!isDashActive) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = C.normalText
              }
            }}
          >
            <span
              className="w-4 h-4 text-sm flex items-center justify-center flex-shrink-0"
              style={{ opacity: isDashActive ? 1 : 0.55 }}
            >
              ☀️
            </span>
            <span>Dashboard</span>
          </Link>
        </div>
      </div>

      {/* ---- Séparateur ---- */}
      <div className="mx-2 my-1" style={{ height: '1px', backgroundColor: C.divider }} />

      {/* ---- Navigation ---- */}
      <nav className="flex-1 px-2 pb-2 overflow-y-auto">
        {NAV.map((section, idx) => {
          const isOpen        = openSections.includes(section.id)
          const hasActiveChild = section.children.some(c => pathname.startsWith(c.href))
          /* La barre de section s'affiche uniquement quand fermée avec un enfant actif */
          const showSectionBar = hasActiveChild && !isOpen

          return (
            <div key={section.id} style={{ marginTop: idx === 0 ? '4px' : '6px' }}>

              {/* ---- En-tête de section ---- */}
              <div className="relative">
                <ActiveBar visible={showSectionBar} />

                <button
                  onClick={() => !section.disabled && toggleSection(section.id)}
                  disabled={section.disabled}
                  className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] text-left select-none"
                  style={{
                    color: section.disabled
                      ? C.disabled
                      : hasActiveChild
                      ? C.activeText
                      : C.normalText,
                    backgroundColor: showSectionBar
                      ? C.activeBg
                      : isOpen
                      ? C.openBg
                      : 'transparent',
                    cursor:     section.disabled ? 'default' : 'pointer',
                    fontWeight: hasActiveChild ? 500 : 400,
                    transition: TRANSITION,
                  }}
                  onMouseEnter={e => {
                    if (!section.disabled && !showSectionBar && !isOpen)
                      e.currentTarget.style.backgroundColor = C.hoverBg
                  }}
                  onMouseLeave={e => {
                    if (!section.disabled && !showSectionBar && !isOpen)
                      e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {/* Emoji icône */}
                  <span
                    className="w-4 h-4 text-sm flex items-center justify-center flex-shrink-0"
                    style={{ opacity: section.disabled ? 0.3 : hasActiveChild ? 1 : 0.55 }}
                  >
                    {section.emoji}
                  </span>

                  <span className="flex-1 truncate">{section.label}</span>

                  {/* Badge phase */}
                  {section.phaseLabel && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ backgroundColor: C.phaseBg, color: C.phaseText }}
                    >
                      {section.phaseLabel}
                    </span>
                  )}

                  {/* Chevron */}
                  {!section.disabled && section.children.length > 0 && (
                    <span
                      className="flex-shrink-0 text-[10px]"
                      style={{
                        color:     C.chevron,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        display:   'inline-block',
                        transition: 'transform 200ms ease',
                      }}
                    >
                      ▾
                    </span>
                  )}
                </button>
              </div>

              {/* ---- Sous-items ---- */}
              {isOpen && !section.disabled && section.children.length > 0 && (
                <div
                  className="mt-0.5 mb-0.5 space-y-px"
                  style={{
                    marginLeft:  '22px',
                    paddingLeft: '8px',
                    borderLeft:  `1px solid ${C.indentLine}`,
                  }}
                >
                  {section.children.map(child => {
                    const isActive = pathname.startsWith(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex items-center py-[6px] rounded-md text-[12.5px] select-none"
                        style={{
                          /* Barre gauche via border-left : transparent → coloré, sans décalage layout */
                          paddingLeft:  isActive ? '6px'         : '8px',
                          paddingRight: '8px',
                          borderLeft:   `2px solid ${isActive ? C.activeBar : 'rgba(124,196,124,0)'}`,
                          color:            isActive ? C.subActive : C.subNormal,
                          backgroundColor:  isActive ? C.activeBg  : 'transparent',
                          fontWeight:       isActive ? 500 : 400,
                          transition:       `${TRANSITION}, border-color 150ms ease, padding-left 150ms ease`,
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = C.hoverBg
                            e.currentTarget.style.color = C.subHover
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = C.subNormal
                          }
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

      {/* ---- Pied : email + déconnexion ---- */}
      <div
        className="px-2 py-2 mt-auto flex-shrink-0"
        style={{ borderTop: `1px solid ${C.divider}` }}
      >
        {userEmail && (
          <div
            className="text-[11px] px-3 py-1 mb-1 truncate"
            style={{ color: C.footerEmail }}
            title={userEmail}
          >
            {userEmail}
          </div>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] text-left select-none"
            style={{ color: C.normalText, transition: TRANSITION }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = C.hoverBg
              e.currentTarget.style.color = C.hoverText
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = C.normalText
            }}
          >
            <span
              className="w-4 h-4 text-sm flex items-center justify-center flex-shrink-0"
              style={{ opacity: 0.45 }}
            >
              ↪
            </span>
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  )
}

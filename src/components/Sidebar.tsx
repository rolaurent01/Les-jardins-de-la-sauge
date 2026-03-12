'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/app/login/actions'
import FarmSelector from '@/components/layout/FarmSelector'
import OrgSwitcher from '@/components/layout/OrgSwitcher'

/* ---------------------------------------------------------------
   Design tokens — couleurs structurelles (non liées au branding)
   Le fond de la sidebar utilise var(--color-primary) injecté par [orgSlug]/layout.tsx
--------------------------------------------------------------- */
const C = {
  // Item actif
  activeBg:      'rgba(255,255,255,0.13)',
  activeBar:     '#7DC87D',
  activeText:    '#F3F8F3',
  // Hover
  hoverBg:       'rgba(255,255,255,0.08)',
  hoverText:     'rgba(255,255,255,0.92)',
  // Normal
  normalText:    'rgba(255,255,255,0.78)',
  // Labels de section
  sectionText:   'rgba(255,255,255,0.62)',
  sectionActive: 'rgba(255,255,255,0.95)',
  sectionHover:  'rgba(255,255,255,0.88)',
  // Structure
  divider:       'rgba(255,255,255,0.06)',
  chevron:       'rgba(255,255,255,0.35)',
  // Badges
  badgeBg:       'rgba(255,255,255,0.07)',
  badgeText:     'rgba(255,255,255,0.38)',
  // Footer
  emailText:     'rgba(255,255,255,0.36)',
} as const

/* ---------------------------------------------------------------
   BrandHeader — logo dynamique par organisation
--------------------------------------------------------------- */
function BrandHeader({
  organization,
}: {
  organization: { nom_affiche: string | null; logo_url: string | null }
}) {
  const displayName = organization.nom_affiche ?? 'Mon Jardin'

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-[12px] flex-shrink-0"
      style={{ borderBottom: `1px solid ${C.divider}` }}
    >
      {/* Logo ou placeholder lettre */}
      {organization.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={organization.logo_url}
          alt={displayName}
          className="w-[26px] h-[26px] rounded-[6px] object-contain flex-shrink-0"
        />
      ) : (
        <div
          className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center flex-shrink-0 text-white font-semibold"
          style={{
            backgroundColor: 'var(--color-primary-light)',
            fontSize: '12px',
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="leading-[1.25] truncate">
        <p className="text-[12.5px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {displayName}
        </p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------
   Chevron SVG — plus propre que le caractère ▾
--------------------------------------------------------------- */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className="w-2.5 h-2.5 flex-shrink-0"
      fill="none"
      style={{
        color:     C.chevron,
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 200ms ease-out',
      }}
    >
      <path
        d="M2 3.5L5 6.5L8 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ---------------------------------------------------------------
   Types navigation
--------------------------------------------------------------- */
type NavChild   = { label: string; href: string }
type NavSection = {
  id:          string
  label:       string
  emoji:       string
  children:    NavChild[]
  disabled?:   boolean
  phaseLabel?: string
}

/** Chemins relatifs — préfixés avec /{orgSlug} au rendu via href() */
const NAV: NavSection[] = [
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
      { label: 'Plantation',     href: '/parcelles/plantations'  },
      { label: 'Suivi de rang',  href: '/parcelles/suivi-rang'   },
      { label: 'Cueillette',     href: '/parcelles/cueillette'   },
      { label: 'Arrachage',      href: '/parcelles/arrachage'    },
      { label: 'Occultation',    href: '/parcelles/occultation'  },
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
      { label: 'Recettes',             href: '/produits/recettes' },
      { label: 'Production de lots',   href: '/produits/production' },
      { label: 'Stock produits finis', href: '/produits/stock'    },
    ],
  },
  {
    id: 'stock',
    label: 'Affinage du stock',
    emoji: '📦',
    children: [
      { label: 'Achats',          href: '/stock/achats'       },
      { label: 'Ventes directes', href: '/stock/ventes'       },
      { label: 'Ajustements',     href: '/stock/ajustements'  },
    ],
  },
  {
    id: 'analyse',
    label: 'Analyse',
    emoji: '📊',
    children: [
      { label: 'Prévisionnel',    href: '/previsionnel' },
      { label: 'Vue Stock',       href: '/stock/vue-stock' },
      { label: 'Vue Production',  href: '/production-totale' },
    ],
  },
  {
    id: 'referentiel',
    label: 'Référentiel',
    emoji: '⚙️',
    children: [
      { label: 'Variétés',                 href: '/referentiel/varietes'      },
      { label: 'Mes variétés',             href: '/referentiel/mes-varietes'  },
      { label: 'Sites & Parcelles',        href: '/referentiel/sites'         },
      { label: 'Produits complémentaires', href: '/referentiel/materiaux'     },
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

/* ---------------------------------------------------------------
   Sidebar principale
--------------------------------------------------------------- */
type SidebarProps = {
  userEmail?: string
  organization: { nom_affiche: string | null; logo_url: string | null }
  farms: { id: string; nom: string }[]
  activeFarmId: string
  orgSlug: string
  isPlatformAdmin?: boolean
  /** Liste de toutes les organisations — passée uniquement pour les platform_admins */
  allOrganizations?: { slug: string; nom: string }[]
}

export default function Sidebar({ userEmail, organization, farms, activeFarmId, orgSlug, isPlatformAdmin = false, allOrganizations }: SidebarProps) {
  const pathname = usePathname()

  /** Construit le chemin absolu avec le préfixe orgSlug */
  function h(path: string) {
    return `/${orgSlug}${path}`
  }

  const dashboardHref = h('/dashboard')
  const isDashActive = pathname === dashboardHref

  const initialOpen = NAV
    .filter(s => s.children.some(c => pathname.startsWith(h(c.href))))
    .map(s => s.id)

  const [openSection, setOpenSection] = useState<string | null>(
    initialOpen.length > 0 ? initialOpen[0] : NAV[0].id
  )

  function toggleSection(id: string) {
    setOpenSection(prev => (prev === id ? null : id))
  }

  return (
    <aside
      className="flex flex-col h-screen w-60 flex-shrink-0 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >

      {/* ── Header ─────────────────────────────── */}
      <BrandHeader organization={organization} />

      {/* ── Sélecteur d'organisation (visible uniquement pour les super admins) ── */}
      {isPlatformAdmin && allOrganizations && (
        <OrgSwitcher organizations={allOrganizations} activeOrgSlug={orgSlug} />
      )}

      {/* ── Sélecteur de ferme (visible si ≥ 2 fermes) ── */}
      <FarmSelector farms={farms} activeFarmId={activeFarmId} />

      {/* ── Dashboard ──────────────────────────── */}
      <div className="px-3 pt-2.5 pb-1">
        <Link
          href={dashboardHref}
          onClick={() => setOpenSection(null)}
          className="flex items-center gap-2.5 rounded-md text-[13px] font-medium"
          style={{
            padding:         '6px 8px',
            color:           isDashActive ? C.sectionActive : C.sectionText,
            backgroundColor: isDashActive ? C.activeBg     : 'transparent',
            transition:      'all 150ms ease-out',
          }}
          onMouseEnter={e => {
            if (!isDashActive) {
              e.currentTarget.style.backgroundColor = C.hoverBg
              e.currentTarget.style.color = C.sectionHover
            }
          }}
          onMouseLeave={e => {
            if (!isDashActive) {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = C.sectionText
            }
          }}
        >
          <span style={{ opacity: isDashActive ? 0.9 : 0.55, lineHeight: 1, fontSize: '13px' }}>☀️</span>
          <span>Dashboard</span>
        </Link>
      </div>

      {/* ── Séparateur ─────────────────────────── */}
      <div className="mx-3 mt-1.5 mb-0.5" style={{ height: '1px', backgroundColor: C.divider }} />

      {/* ── Navigation ─────────────────────────── */}
      <nav className="flex-1 px-3 pt-1 pb-4 overflow-y-auto">
        {NAV.map((section, idx) => {
          const isOpen = openSection === section.id

          return (
            <div key={section.id} style={{ marginTop: idx === 0 ? '6px' : '10px' }}>

              {/* ── Section header ── */}
              <button
                onClick={() => !section.disabled && toggleSection(section.id)}
                disabled={section.disabled}
                className="w-full flex items-center gap-2 rounded-md text-left"
                style={{
                  padding:         '6px 8px',
                  fontSize:        '13px',
                  fontWeight:      500,
                  letterSpacing:   '0.01em',
                  color: section.disabled
                    ? 'rgba(255,255,255,0.18)'
                    : isOpen
                    ? C.sectionActive
                    : C.sectionText,
                  backgroundColor: isOpen ? C.activeBg : 'transparent',
                  cursor:          section.disabled ? 'default' : 'pointer',
                  transition:      'all 150ms ease-out',
                }}
                onMouseEnter={e => {
                  if (!section.disabled && !isOpen) {
                    e.currentTarget.style.backgroundColor = C.hoverBg
                    e.currentTarget.style.color = C.sectionHover
                  }
                }}
                onMouseLeave={e => {
                  if (!section.disabled) {
                    e.currentTarget.style.backgroundColor = isOpen ? C.activeBg : 'transparent'
                    e.currentTarget.style.color = isOpen ? C.sectionActive : C.sectionText
                  }
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    lineHeight: 1,
                    opacity: section.disabled ? 0.2 : isOpen ? 0.9 : 0.55,
                    flexShrink: 0,
                  }}
                >
                  {section.emoji}
                </span>

                <span className="flex-1 truncate">{section.label}</span>

                {section.phaseLabel && (
                  <span
                    className="flex-shrink-0 rounded"
                    style={{
                      fontSize:        '9px',
                      padding:         '2px 5px',
                      letterSpacing:   '0.05em',
                      backgroundColor: C.badgeBg,
                      color:           C.badgeText,
                    }}
                  >
                    {section.phaseLabel}
                  </span>
                )}

                {!section.disabled && section.children.length > 0 && (
                  <Chevron open={isOpen} />
                )}
              </button>

              {/* ── Sous-items ── */}
              {isOpen && !section.disabled && section.children.length > 0 && (
                <div
                  className="mt-0.5 space-y-px"
                  style={{ paddingLeft: '6px' }}
                >
                  {section.children.map(child => {
                    const childHref = h(child.href)
                    const isActive = pathname.startsWith(childHref)
                    return (
                      <Link
                        key={child.href}
                        href={childHref}
                        className="flex items-center rounded-md text-[13px]"
                        style={{
                          paddingTop:    '6px',
                          paddingBottom: '6px',
                          paddingLeft:   isActive ? '8px'  : '10px',
                          paddingRight:  '10px',
                          color:           isActive ? C.activeText : C.normalText,
                          backgroundColor: isActive ? C.activeBg   : 'transparent',
                          fontWeight:      isActive ? 500 : 400,
                          borderLeft:      `2px solid ${isActive ? C.activeBar : 'transparent'}`,
                          transition:      'all 150ms ease-out',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = C.hoverBg
                            e.currentTarget.style.color = C.hoverText
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = C.normalText
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

      {/* ── Lien Admin (visible uniquement pour les super admins) ── */}
      {isPlatformAdmin && (
        <div className="px-3 pb-1 flex-shrink-0">
          <Link
            href={h('/admin/organisations')}
            className="flex items-center gap-2.5 rounded-md text-[12.5px]"
            style={{
              padding: '7px 10px',
              color: pathname.includes('/admin/') ? C.activeText : C.normalText,
              backgroundColor: pathname.includes('/admin/') ? C.activeBg : 'transparent',
              transition: 'all 150ms ease-out',
            }}
            onMouseEnter={e => {
              if (!pathname.includes('/admin/')) {
                e.currentTarget.style.backgroundColor = C.hoverBg
                e.currentTarget.style.color = C.hoverText
              }
            }}
            onMouseLeave={e => {
              if (!pathname.includes('/admin/')) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = C.normalText
              }
            }}
          >
            <span style={{ opacity: pathname.includes('/admin/') ? 0.9 : 0.55, fontSize: '13px', lineHeight: 1 }}>&#x1F527;</span>
            <span>Admin</span>
          </Link>
        </div>
      )}

      {/* ── Lien Mode terrain ────────────────────── */}
      <div className="px-3 pb-1 flex-shrink-0">
        <Link
          href={h('/m/saisie')}
          className="flex items-center gap-2.5 rounded-md text-[12.5px]"
          style={{
            padding: '7px 10px',
            color: C.normalText,
            transition: 'all 150ms ease-out',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = C.hoverBg
            e.currentTarget.style.color = C.hoverText
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = C.normalText
          }}
        >
          <span style={{ opacity: 0.55, fontSize: '13px', lineHeight: 1 }}>📱</span>
          <span>Mode terrain</span>
        </Link>
      </div>

      {/* ── Footer ─────────────────────────────── */}
      <div
        className="px-3 py-2.5 flex-shrink-0"
        style={{ borderTop: `1px solid ${C.divider}` }}
      >
        {userEmail && (
          <p
            className="text-[10.5px] px-2.5 py-1 mb-1 truncate"
            style={{ color: C.emailText }}
            title={userEmail}
          >
            {userEmail}
          </p>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 rounded-md text-[12.5px] text-left"
            style={{
              padding:    '7px 10px',
              color:      C.normalText,
              transition: 'all 150ms ease-out',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = C.hoverBg
              e.currentTarget.style.color = C.hoverText
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = C.normalText
            }}
          >
            <span style={{ opacity: 0.38, fontSize: '12px', lineHeight: 1 }}>↪</span>
            <span>Déconnexion</span>
          </button>
        </form>
      </div>

    </aside>
  )
}

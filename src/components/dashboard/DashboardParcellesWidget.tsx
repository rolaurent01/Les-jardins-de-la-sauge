'use client'

import { useState } from 'react'
import type { DashboardParcelleData } from '@/app/[orgSlug]/(dashboard)/dashboard/actions'

/** Couleur stable basée sur le nom (hash simple → HSL) */
function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 55%)`
}

const METHODE_LABELS: Record<string, string> = {
  paille: 'Paille',
  foin: 'Foin',
  bache: 'Bâche',
  engrais_vert: 'Engrais vert',
}

interface Props {
  data: DashboardParcelleData[]
}

export function DashboardParcellesWidget({ data }: Props) {
  if (data.length === 0) {
    return (
      <WidgetCard>
        <WidgetTitle />
        <p className="text-sm py-4" style={{ color: '#9CA89D' }}>
          Aucune parcelle configurée. Ajoutez des sites, parcelles et rangs dans le référentiel.
        </p>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard>
      <WidgetTitle />
      <div className="space-y-4">
        {data.map(site => (
          <SiteBlock key={site.site_nom} site={site} />
        ))}
      </div>
    </WidgetCard>
  )
}

function WidgetCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 border md:col-span-2"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

function WidgetTitle() {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#2C3E2D' }}>
        <span>🗺️</span> Vue Parcelles
      </h2>
    </div>
  )
}

function SiteBlock({ site }: { site: DashboardParcelleData }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: '#2C3E2D' }}>
        {site.site_nom}
      </h3>
      <div className="space-y-2">
        {site.parcelles.map(parcelle => (
          <ParcelAccordion key={parcelle.parcelle_code} parcelle={parcelle} />
        ))}
      </div>
    </div>
  )
}

function ParcelAccordion({ parcelle }: { parcelle: DashboardParcelleData['parcelles'][number] }) {
  // Fermé par défaut — l'utilisateur clique pour afficher les rangs
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border" style={{ borderColor: '#E8E4DE' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
      >
        <span className="text-xs font-medium" style={{ color: '#6B7B6C' }}>
          {parcelle.parcelle_nom} ({parcelle.parcelle_code}) — {parcelle.rangs.length} rangs
        </span>
        <span className="text-xs" style={{ color: '#9CA89D' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1">
          {parcelle.rangs.map(rang => (
            <RowBar key={rang.numero} rang={rang} />
          ))}
        </div>
      )}
    </div>
  )
}

function RowBar({ rang }: { rang: DashboardParcelleData['parcelles'][number]['rangs'][number] }) {
  // Rang vide
  if (rang.est_vide) {
    return (
      <div
        className="flex items-center rounded-md px-2 h-8"
        style={{ backgroundColor: '#F3F4F6' }}
      >
        <span className="text-xs font-medium mr-2" style={{ color: '#9CA89D' }}>R{rang.numero}</span>
        <span className="text-xs italic" style={{ color: '#C0C0C0' }}>Vide</span>
      </div>
    )
  }

  // Occultation active
  if (rang.occultation_active && rang.plantings.length === 0) {
    return (
      <div
        className="flex items-center rounded-md px-2 h-8"
        style={{ backgroundColor: '#FFF3E0', border: '1px dashed #FFB74D' }}
      >
        <span className="text-xs font-medium mr-2" style={{ color: '#E65100' }}>R{rang.numero}</span>
        <span className="text-xs" style={{ color: '#E65100' }}>
          {METHODE_LABELS[rang.occultation_active.methode] ?? rang.occultation_active.methode}
        </span>
      </div>
    )
  }

  // Planté (une ou plusieurs variétés)
  if (rang.plantings.length === 1) {
    const p = rang.plantings[0]
    const color = hashColor(p.variete)
    return (
      <div
        className="flex items-center rounded-md px-2 h-8"
        style={{ backgroundColor: color + '20', borderLeft: `3px solid ${color}` }}
      >
        <span className="text-xs font-medium mr-2" style={{ color: '#2C3E2D' }}>R{rang.numero}</span>
        <span className="text-xs font-medium truncate" style={{ color }}>{p.variete}</span>
      </div>
    )
  }

  // Multi-variétés
  return (
    <div className="flex items-center rounded-md overflow-hidden h-8">
      <span
        className="text-xs font-medium px-2 flex-shrink-0"
        style={{ color: '#2C3E2D', backgroundColor: '#F3F4F6' }}
      >
        R{rang.numero}
      </span>
      {rang.plantings.map((p, i) => {
        const color = hashColor(p.variete)
        return (
          <div
            key={i}
            className="flex-1 flex items-center px-1.5 h-full min-w-0"
            style={{ backgroundColor: color + '20', borderLeft: i > 0 ? `1px solid ${color}40` : `3px solid ${color}` }}
          >
            <span className="text-xs font-medium truncate" style={{ color }}>{p.variete}</span>
          </div>
        )
      })}
    </div>
  )
}

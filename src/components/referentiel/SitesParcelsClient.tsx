'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Site, ParcelWithSite, RowWithParcel, ActionResult } from '@/lib/types'
import {
  createSite, updateSite, archiveSite, restoreSite,
  createParcel, updateParcel, archiveParcel, restoreParcel,
  createRow, updateRow, archiveRow, restoreRow,
} from '@/app/[orgSlug]/(dashboard)/referentiel/sites/actions'
import SiteSlideOver from './SiteSlideOver'
import ParcelleSlideOver from './ParcelleSlideOver'
import RangSlideOver from './RangSlideOver'
import { normalize } from '@/lib/utils/normalize'
import { Th } from '@/components/ui/Th'

type Tab = 'sites' | 'parcelles' | 'rangs'

type Props = {
  initialSites: Site[]
  initialParcels: ParcelWithSite[]
  initialRows: RowWithParcel[]
}

export default function SitesParcelsClient({ initialSites, initialParcels, initialRows }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState<Tab>('sites')
  const [sites, setSites] = useState(initialSites)
  const [parcels, setParcels] = useState(initialParcels)
  const [rows, setRows] = useState(initialRows)

  /* État des slide-overs */
  const [siteSlide, setSiteSlide] = useState<{ open: boolean; item: Site | null }>({ open: false, item: null })
  const [parcelSlide, setParcelSlide] = useState<{ open: boolean; item: ParcelWithSite | null }>({ open: false, item: null })
  const [rowSlide, setRowSlide] = useState<{ open: boolean; item: RowWithParcel | null }>({ open: false, item: null })

  const [pendingId, setPendingId] = useState<string | null>(null)

  /* Sync quand Next.js re-fetche */
  useEffect(() => { setSites(initialSites) }, [initialSites])
  useEffect(() => { setParcels(initialParcels) }, [initialParcels])
  useEffect(() => { setRows(initialRows) }, [initialRows])

  function refresh() { router.refresh() }

  /* ---- Handlers Sites ---- */
  async function handleSaveSite(fd: FormData): Promise<ActionResult> {
    if (siteSlide.item) return updateSite(siteSlide.item.id, fd)
    return createSite(fd)
  }
  function handleArchiveSite(id: string) {
    setPendingId(id)
    startTransition(async () => { await archiveSite(id); setPendingId(null); refresh() })
  }
  function handleRestoreSite(id: string) {
    setPendingId(id)
    startTransition(async () => { await restoreSite(id); setPendingId(null); refresh() })
  }

  /* ---- Handlers Parcelles ---- */
  async function handleSaveParcel(fd: FormData): Promise<ActionResult> {
    if (parcelSlide.item) return updateParcel(parcelSlide.item.id, fd)
    return createParcel(fd)
  }
  function handleArchiveParcel(id: string) {
    setPendingId(id)
    startTransition(async () => { await archiveParcel(id); setPendingId(null); refresh() })
  }
  function handleRestoreParcel(id: string) {
    setPendingId(id)
    startTransition(async () => { await restoreParcel(id); setPendingId(null); refresh() })
  }

  /* ---- Handlers Rangs ---- */
  async function handleSaveRow(fd: FormData): Promise<ActionResult> {
    if (rowSlide.item) return updateRow(rowSlide.item.id, fd)
    return createRow(fd)
  }
  function handleArchiveRow(id: string) {
    setPendingId(id)
    startTransition(async () => { await archiveRow(id); setPendingId(null); refresh() })
  }
  function handleRestoreRow(id: string) {
    setPendingId(id)
    startTransition(async () => { await restoreRow(id); setPendingId(null); refresh() })
  }

  const sitesActive   = sites.filter(s => !s.deleted_at).length
  const parcelsActive = parcels.filter(p => !p.deleted_at).length
  const rowsActive    = rows.filter(r => !r.deleted_at).length

  const TAB_DEFS: { key: Tab; label: string; count: number }[] = [
    { key: 'sites',     label: 'Sites',     count: sitesActive },
    { key: 'parcelles', label: 'Parcelles', count: parcelsActive },
    { key: 'rangs',     label: 'Rangs',     count: rowsActive },
  ]

  return (
    <div className="p-8">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#2C3E2D' }}>
          Sites &amp; Parcelles
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#9CA89D' }}>
          Référentiel géographique — sites, parcelles, rangs
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid #D8E0D9' }}>
        {TAB_DEFS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: activeTab === tab.key ? 'var(--color-primary)' : '#9CA89D',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
            <span
              className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: activeTab === tab.key ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : '#F5F2ED',
                color: activeTab === tab.key ? 'var(--color-primary)' : '#9CA89D',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === 'sites' && (
        <SitesTab
          sites={sites}
          pendingId={pendingId}
          onOpenCreate={() => setSiteSlide({ open: true, item: null })}
          onOpenEdit={item => setSiteSlide({ open: true, item })}
          onArchive={handleArchiveSite}
          onRestore={handleRestoreSite}
        />
      )}
      {activeTab === 'parcelles' && (
        <ParcellesTab
          parcels={parcels}
          pendingId={pendingId}
          onOpenCreate={() => setParcelSlide({ open: true, item: null })}
          onOpenEdit={item => setParcelSlide({ open: true, item })}
          onArchive={handleArchiveParcel}
          onRestore={handleRestoreParcel}
        />
      )}
      {activeTab === 'rangs' && (
        <RangsTab
          rows={rows}
          pendingId={pendingId}
          onOpenCreate={() => setRowSlide({ open: true, item: null })}
          onOpenEdit={item => setRowSlide({ open: true, item })}
          onArchive={handleArchiveRow}
          onRestore={handleRestoreRow}
        />
      )}

      {/* Slide-overs */}
      <SiteSlideOver
        key={siteSlide.item?.id ?? 'new-site'}
        open={siteSlide.open}
        site={siteSlide.item}
        onClose={() => setSiteSlide(s => ({ ...s, open: false }))}
        onSubmit={handleSaveSite}
        onSuccess={() => { setSiteSlide(s => ({ ...s, open: false })); refresh() }}
      />
      <ParcelleSlideOver
        key={parcelSlide.item?.id ?? 'new-parcel'}
        open={parcelSlide.open}
        parcel={parcelSlide.item}
        sites={sites.filter(s => !s.deleted_at)}
        onClose={() => setParcelSlide(s => ({ ...s, open: false }))}
        onSubmit={handleSaveParcel}
        onSuccess={() => { setParcelSlide(s => ({ ...s, open: false })); refresh() }}
      />
      <RangSlideOver
        key={rowSlide.item?.id ?? 'new-row'}
        open={rowSlide.open}
        row={rowSlide.item}
        parcels={parcels.filter(p => !p.deleted_at)}
        onClose={() => setRowSlide(s => ({ ...s, open: false }))}
        onSubmit={handleSaveRow}
        onSuccess={() => { setRowSlide(s => ({ ...s, open: false })); refresh() }}
      />
    </div>
  )
}

/* ============================================================
   Onglet Sites
   ============================================================ */
function SitesTab({
  sites, pendingId, onOpenCreate, onOpenEdit, onArchive, onRestore,
}: {
  sites: Site[]
  pendingId: string | null
  onOpenCreate: () => void
  onOpenEdit: (item: Site) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 4000)
    return () => clearTimeout(t)
  }, [confirmId])

  const active   = sites.filter(s => !s.deleted_at)
  const archived = sites.filter(s => !!s.deleted_at)

  const displayed = (showArchived ? archived : active).filter(s => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(s.nom).includes(q) ||
      (s.description && normalize(s.description).includes(q))
    )
  })

  function handleArchiveClick(id: string) {
    if (confirmId === id) { setConfirmId(null); onArchive(id) }
    else setConfirmId(id)
  }

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Rechercher par nom…"
        showArchived={showArchived}
        archivedCount={archived.length}
        onToggleArchived={() => setShowArchived(v => !v)}
        onAdd={onOpenCreate}
        addLabel="Nouveau site"
      />
      <CountLine
        activeCount={active.length}
        archivedCount={archived.length}
        singular="site actif"
        plural="sites actifs"
        archivedLabel="archivé"
      />

      {displayed.length === 0 ? (
        <EmptyState icon="📍" search={search} showArchived={showArchived} entityName="site" />
      ) : (
        <EntityTable>
          <thead>
            <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
              <Th>Nom</Th>
              <Th>Description</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((s, i) => (
              <tr
                key={s.id}
                style={{
                  backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                  borderBottom: '1px solid #EDE8E0',
                  opacity: (!!s.deleted_at || pendingId === s.id) ? 0.5 : 1,
                }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>{s.nom}</td>
                <td className="px-4 py-3" style={{ color: '#6B7B6C' }}>{s.description ?? <Dash />}</td>
                <td className="px-4 py-3">
                  <RowActions
                    isArchived={!!s.deleted_at}
                    isPending={pendingId === s.id}
                    isConfirming={confirmId === s.id}
                    onEdit={() => onOpenEdit(s)}
                    onArchiveClick={() => handleArchiveClick(s.id)}
                    onCancelConfirm={() => setConfirmId(null)}
                    onRestore={() => onRestore(s.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </EntityTable>
      )}
    </>
  )
}

/* ============================================================
   Onglet Parcelles
   ============================================================ */
function ParcellesTab({
  parcels, pendingId, onOpenCreate, onOpenEdit, onArchive, onRestore,
}: {
  parcels: ParcelWithSite[]
  pendingId: string | null
  onOpenCreate: () => void
  onOpenEdit: (item: ParcelWithSite) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 4000)
    return () => clearTimeout(t)
  }, [confirmId])

  const active   = parcels.filter(p => !p.deleted_at)
  const archived = parcels.filter(p => !!p.deleted_at)

  const displayed = (showArchived ? archived : active).filter(p => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(p.nom).includes(q) ||
      normalize(p.code).includes(q) ||
      (p.sites && normalize(p.sites.nom).includes(q)) ||
      (p.description && normalize(p.description).includes(q))
    )
  })

  function handleArchiveClick(id: string) {
    if (confirmId === id) { setConfirmId(null); onArchive(id) }
    else setConfirmId(id)
  }

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Rechercher par code, nom, site…"
        showArchived={showArchived}
        archivedCount={archived.length}
        onToggleArchived={() => setShowArchived(v => !v)}
        onAdd={onOpenCreate}
        addLabel="Nouvelle parcelle"
      />
      <CountLine
        activeCount={active.length}
        archivedCount={archived.length}
        singular="parcelle active"
        plural="parcelles actives"
        archivedLabel="archivée"
      />

      {displayed.length === 0 ? (
        <EmptyState icon="🗺️" search={search} showArchived={showArchived} entityName="parcelle" />
      ) : (
        <EntityTable>
          <thead>
            <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
              <Th>Code</Th>
              <Th>Nom</Th>
              <Th>Site</Th>
              <Th>Orientation</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p, i) => (
              <tr
                key={p.id}
                style={{
                  backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                  borderBottom: '1px solid #EDE8E0',
                  opacity: (!!p.deleted_at || pendingId === p.id) ? 0.5 : 1,
                }}
              >
                <td className="px-4 py-3 font-mono text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                  {p.code}
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>{p.nom}</td>
                <td className="px-4 py-3 text-sm" style={{ color: '#6B7B6C' }}>
                  {p.sites?.nom ?? <Dash />}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#6B7B6C' }}>
                  {p.orientation ?? <Dash />}
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    isArchived={!!p.deleted_at}
                    isPending={pendingId === p.id}
                    isConfirming={confirmId === p.id}
                    onEdit={() => onOpenEdit(p)}
                    onArchiveClick={() => handleArchiveClick(p.id)}
                    onCancelConfirm={() => setConfirmId(null)}
                    onRestore={() => onRestore(p.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </EntityTable>
      )}
    </>
  )
}

/* ============================================================
   Onglet Rangs
   ============================================================ */
function RangsTab({
  rows, pendingId, onOpenCreate, onOpenEdit, onArchive, onRestore,
}: {
  rows: RowWithParcel[]
  pendingId: string | null
  onOpenCreate: () => void
  onOpenEdit: (item: RowWithParcel) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 4000)
    return () => clearTimeout(t)
  }, [confirmId])

  const active   = rows.filter(r => !r.deleted_at)
  const archived = rows.filter(r => !!r.deleted_at)

  const displayed = (showArchived ? archived : active).filter(r => {
    if (!search.trim()) return true
    const q = normalize(search)
    return (
      normalize(r.numero).includes(q) ||
      (r.ancien_numero && normalize(r.ancien_numero).includes(q)) ||
      (r.parcels && normalize(r.parcels.code).includes(q)) ||
      (r.parcels && normalize(r.parcels.nom).includes(q)) ||
      (r.parcels?.sites && normalize(r.parcels.sites.nom).includes(q))
    )
  })

  function handleArchiveClick(id: string) {
    if (confirmId === id) { setConfirmId(null); onArchive(id) }
    else setConfirmId(id)
  }

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Rechercher par numéro, parcelle, site…"
        showArchived={showArchived}
        archivedCount={archived.length}
        onToggleArchived={() => setShowArchived(v => !v)}
        onAdd={onOpenCreate}
        addLabel="Nouveau rang"
      />
      <CountLine
        activeCount={active.length}
        archivedCount={archived.length}
        singular="rang actif"
        plural="rangs actifs"
        archivedLabel="archivé"
      />

      {displayed.length === 0 ? (
        <EmptyState icon="🌿" search={search} showArchived={showArchived} entityName="rang" />
      ) : (
        <EntityTable>
          <thead>
            <tr style={{ backgroundColor: '#F5F2ED', borderBottom: '1px solid #D8E0D9' }}>
              <Th>Numéro</Th>
              <Th>Ancienne réf.</Th>
              <Th>Parcelle</Th>
              <Th>Site</Th>
              <Th align="right">Longueur</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => (
              <tr
                key={r.id}
                style={{
                  backgroundColor: i % 2 === 0 ? '#FAF5E9' : '#F9F8F6',
                  borderBottom: '1px solid #EDE8E0',
                  opacity: (!!r.deleted_at || pendingId === r.id) ? 0.5 : 1,
                }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: '#2C3E2D' }}>
                  {r.numero}
                  {r.notes && (
                    <span className="ml-1.5 text-xs" style={{ color: '#9CA89D' }} title={r.notes}>💬</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#9CA89D' }}>
                  {r.ancien_numero ?? <Dash />}
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.parcels ? (
                    <span>
                      <span className="font-mono" style={{ color: 'var(--color-primary)' }}>{r.parcels.code}</span>
                      <span style={{ color: '#6B7B6C' }}> · {r.parcels.nom}</span>
                    </span>
                  ) : <Dash />}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#6B7B6C' }}>
                  {r.parcels?.sites?.nom ?? <Dash />}
                </td>
                <td className="px-4 py-3 text-right text-sm" style={{ color: '#6B7B6C' }}>
                  {r.longueur_m != null ? `${r.longueur_m} m` : <Dash />}
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    isArchived={!!r.deleted_at}
                    isPending={pendingId === r.id}
                    isConfirming={confirmId === r.id}
                    onEdit={() => onOpenEdit(r)}
                    onArchiveClick={() => handleArchiveClick(r.id)}
                    onCancelConfirm={() => setConfirmId(null)}
                    onRestore={() => onRestore(r.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </EntityTable>
      )}
    </>
  )
}

/* ============================================================
   Sous-composants partagés
   ============================================================ */

function Toolbar({
  search, onSearch, placeholder,
  showArchived, archivedCount, onToggleArchived,
  onAdd, addLabel,
}: {
  search: string
  onSearch: (v: string) => void
  placeholder: string
  showArchived: boolean
  archivedCount: number
  onToggleArchived: () => void
  onAdd: () => void
  addLabel: string
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      {/* Champ de recherche */}
      <div className="relative flex-1 max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#9CA89D' }}>
          🔍
        </span>
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
          style={{ backgroundColor: '#FAF5E9', borderColor: '#D8E0D9', color: '#2C3E2D' }}
          onFocus={e  => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={e   => (e.target.style.borderColor = '#D8E0D9')}
        />
      </div>

      {/* Toggle archivés */}
      {archivedCount > 0 && (
        <button
          onClick={onToggleArchived}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border"
          style={{
            borderColor: showArchived ? 'var(--color-primary)' : '#D8E0D9',
            backgroundColor: showArchived ? 'color-mix(in srgb, var(--color-primary) 7%, transparent)' : 'transparent',
            color: showArchived ? 'var(--color-primary)' : '#9CA89D',
          }}
        >
          {showArchived ? '← Actifs' : `Archivés (${archivedCount})`}
        </button>
      )}

      {/* Bouton ajout */}
      <button
        onClick={onAdd}
        className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ backgroundColor: 'var(--color-primary)', color: '#F9F8F6' }}
      >
        <span className="text-base leading-none">＋</span>
        {addLabel}
      </button>
    </div>
  )
}

function CountLine({
  activeCount, archivedCount, singular, plural, archivedLabel,
}: {
  activeCount: number
  archivedCount: number
  singular: string
  plural: string
  archivedLabel: string
}) {
  return (
    <p className="text-sm mb-4" style={{ color: '#9CA89D' }}>
      {activeCount} {activeCount !== 1 ? plural : singular}
      {archivedCount > 0 && (
        <> · {archivedCount} {archivedLabel}{archivedCount !== 1 ? 's' : ''}</>
      )}
    </p>
  )
}

function EntityTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#D8E0D9' }}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

function Dash() {
  return <span style={{ color: '#D8E0D9' }}>—</span>
}

function EmptyState({
  icon, search, showArchived, entityName,
}: {
  icon: string
  search: string
  showArchived: boolean
  entityName: string
}) {
  return (
    <div
      className="text-center py-16 rounded-xl border"
      style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm">
        {search
          ? `Aucun ${entityName} ne correspond à la recherche.`
          : showArchived
          ? `Aucun ${entityName} archivé.`
          : `Aucun ${entityName}. Commencez par en créer un.`}
      </p>
    </div>
  )
}

function RowActions({
  isArchived, isPending, isConfirming, onEdit, onArchiveClick, onCancelConfirm, onRestore,
}: {
  isArchived: boolean
  isPending: boolean
  isConfirming: boolean
  onEdit: () => void
  onArchiveClick: () => void
  onCancelConfirm: () => void
  onRestore: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {isArchived ? (
        <button
          onClick={onRestore}
          disabled={isPending}
          className="px-2.5 py-1 rounded-lg text-xs border"
          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
        >
          Restaurer
        </button>
      ) : isConfirming ? (
        <>
          <button
            onClick={onArchiveClick}
            className="px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ backgroundColor: '#BC6C25', color: '#FFF' }}
          >
            Confirmer
          </button>
          <button
            onClick={onCancelConfirm}
            className="px-2.5 py-1 rounded-lg text-xs border"
            style={{ borderColor: '#D8E0D9', color: '#9CA89D' }}
          >
            Annuler
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg"
            title="Modifier"
            style={{ color: '#9CA89D' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
          >
            ✏️
          </button>
          <button
            onClick={onArchiveClick}
            className="p-1.5 rounded-lg"
            title="Archiver"
            style={{ color: '#9CA89D' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#BC6C25')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA89D')}
          >
            🗄️
          </button>
        </>
      )}
    </div>
  )
}

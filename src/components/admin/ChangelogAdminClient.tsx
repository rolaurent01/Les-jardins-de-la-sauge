'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ChangelogEntry, ChangelogEntryType } from '@/lib/types'
import { CHANGELOG_TYPE_LABELS, CHANGELOG_TYPE_COLORS } from '@/lib/types'
import {
  createChangelogEntry,
  updateChangelogEntry,
  deleteChangelogEntry,
  toggleChangelogPublished,
  fetchCommitSuggestions,
  importCommitSuggestions,
} from '@/app/[orgSlug]/(dashboard)/admin/changelog/actions'
import type { CommitSuggestion } from '@/app/[orgSlug]/(dashboard)/admin/changelog/actions'

export default function ChangelogAdminClient({
  initialEntries,
}: {
  initialEntries: ChangelogEntry[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [entries, setEntries] = useState(initialEntries)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ChangelogEntry | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Import depuis GitHub
  const [showImport, setShowImport] = useState(false)
  const [suggestions, setSuggestions] = useState<CommitSuggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  useEffect(() => { setEntries(initialEntries) }, [initialEntries])

  // ── CRUD handlers ──

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = editing
        ? await updateChangelogEntry(editing.id, formData)
        : await createChangelogEntry(formData)
      if ('error' in res) {
        setError(res.error ?? null)
      } else {
        setShowForm(false)
        setEditing(null)
        router.refresh()
      }
    })
  }

  async function handleTogglePublished(entry: ChangelogEntry) {
    startTransition(async () => {
      const res = await toggleChangelogPublished(entry.id, !entry.published)
      if ('error' in res) setError(res.error ?? null)
      else router.refresh()
    })
  }

  async function handleDelete(entryId: string) {
    startTransition(async () => {
      const res = await deleteChangelogEntry(entryId)
      if ('error' in res) setError(res.error ?? null)
      else {
        setConfirmDeleteId(null)
        router.refresh()
      }
    })
  }

  function openEdit(entry: ChangelogEntry) {
    setEditing(entry)
    setShowForm(true)
    setShowImport(false)
  }

  function openCreate() {
    setEditing(null)
    setShowForm(true)
    setShowImport(false)
  }

  // ── Import handlers ──

  async function handleLoadSuggestions() {
    setError(null)
    setShowImport(true)
    setShowForm(false)
    setLoadingSuggestions(true)
    try {
      const data = await fetchCommitSuggestions()
      setSuggestions(data)
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des commits.')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  function toggleSelection(sha: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sha)) next.delete(sha)
      else next.add(sha)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === suggestions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(suggestions.map(s => s.sha)))
    }
  }

  async function handleImportSelected() {
    setError(null)
    const toImport = suggestions
      .filter(s => selected.has(s.sha))
      .map(s => ({ title: s.title, description: s.description, type: s.type }))

    startTransition(async () => {
      const res = await importCommitSuggestions(toImport)
      if ('error' in res) {
        setError(res.error ?? null)
      } else {
        setShowImport(false)
        setSuggestions([])
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: '#2C3E2D' }}>
          Gestion du changelog
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleLoadSuggestions}
            disabled={loadingSuggestions}
            className="text-sm px-3 py-1.5 rounded-md"
            style={{
              backgroundColor: showImport ? '#E5E7EB' : '#EFF6FF',
              color: showImport ? '#374151' : '#1E40AF',
              opacity: loadingSuggestions ? 0.6 : 1,
            }}
          >
            {loadingSuggestions ? 'Chargement...' : 'Importer depuis les commits'}
          </button>
          <button
            onClick={showForm ? () => { setShowForm(false); setEditing(null) } : openCreate}
            className="text-sm px-3 py-1.5 rounded-md"
            style={{
              backgroundColor: showForm ? '#E5E7EB' : 'var(--color-primary, #3A5A40)',
              color: showForm ? '#374151' : '#fff',
            }}
          >
            {showForm ? 'Annuler' : '+ Nouvelle entrée'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </div>
      )}

      {/* ─── Panel d'import depuis GitHub ─── */}
      {showImport && !loadingSuggestions && (
        <div
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: '#0C4A6E' }}>
              Commits récents (feat / fix)
            </h2>
            <div className="flex gap-2 items-center">
              {suggestions.length > 0 && (
                <>
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ color: '#0C4A6E', backgroundColor: '#E0F2FE' }}
                  >
                    {selected.size === suggestions.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                  <button
                    onClick={handleImportSelected}
                    disabled={selected.size === 0 || isPending}
                    className="text-xs px-3 py-1 rounded-md"
                    style={{
                      backgroundColor: selected.size > 0 ? 'var(--color-primary, #3A5A40)' : '#D1D5DB',
                      color: selected.size > 0 ? '#fff' : '#9CA3AF',
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    {isPending ? 'Import...' : `Importer ${selected.size} entrée${selected.size > 1 ? 's' : ''}`}
                  </button>
                </>
              )}
              <button
                onClick={() => { setShowImport(false); setSuggestions([]); setSelected(new Set()) }}
                className="text-xs px-2 py-1 rounded-md"
                style={{ color: '#6B7280', backgroundColor: '#F3F4F6' }}
              >
                Fermer
              </button>
            </div>
          </div>

          {suggestions.length === 0 ? (
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Aucun commit feat/fix depuis le dernier changelog.
            </p>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map(s => (
                <label
                  key={s.sha}
                  className="flex items-start gap-3 rounded-lg p-2.5 cursor-pointer"
                  style={{
                    backgroundColor: selected.has(s.sha) ? '#DBEAFE' : '#fff',
                    border: `1px solid ${selected.has(s.sha) ? '#93C5FD' : '#E5E7EB'}`,
                    transition: 'all 100ms ease-out',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.sha)}
                    onChange={() => toggleSelection(s.sha)}
                    className="mt-0.5 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: CHANGELOG_TYPE_COLORS[s.type].bg,
                          color: CHANGELOG_TYPE_COLORS[s.type].text,
                        }}
                      >
                        {CHANGELOG_TYPE_LABELS[s.type]}
                      </span>
                      <code className="text-[10px]" style={{ color: '#9CA3AF' }}>{s.sha}</code>
                      <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                        {new Date(s.date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: '#1E293B' }}>
                      {s.title}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Formulaire création/édition ─── */}
      {showForm && (
        <form
          action={handleSubmit}
          className="mb-6 p-4 rounded-xl space-y-3"
          style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
        >
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Titre *</label>
            <input
              name="title"
              required
              maxLength={300}
              defaultValue={editing?.title ?? ''}
              className="w-full text-sm rounded-lg px-3 py-2"
              style={{ border: '1px solid #D1D5DB' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Description *</label>
            <textarea
              name="description"
              required
              maxLength={5000}
              rows={4}
              defaultValue={editing?.description ?? ''}
              className="w-full text-sm rounded-lg px-3 py-2"
              style={{ border: '1px solid #D1D5DB' }}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Type</label>
              <select
                name="type"
                defaultValue={editing?.type ?? 'feature'}
                className="w-full text-sm rounded-lg px-3 py-2"
                style={{ border: '1px solid #D1D5DB' }}
              >
                <option value="feature">Nouveauté</option>
                <option value="improvement">Amélioration</option>
                <option value="fix">Correction</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium block mb-1" style={{ color: '#374151' }}>Statut</label>
              <select
                name="published"
                defaultValue={editing?.published ? 'true' : 'false'}
                className="w-full text-sm rounded-lg px-3 py-2"
                style={{ border: '1px solid #D1D5DB' }}
              >
                <option value="true">Publié</option>
                <option value="false">Brouillon</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-md"
            style={{
              backgroundColor: 'var(--color-primary, #3A5A40)',
              color: '#fff',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Enregistrement...' : editing ? 'Modifier' : 'Créer'}
          </button>
        </form>
      )}

      {/* ─── Liste des entrées existantes ─── */}
      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: '#6B7280' }}>Aucune entrée changelog.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="rounded-xl p-4 flex items-start justify-between"
              style={{
                backgroundColor: '#fff',
                border: `1px solid ${entry.published ? '#E5E7EB' : '#FDE68A'}`,
                opacity: entry.published ? 1 : 0.75,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: CHANGELOG_TYPE_COLORS[entry.type as ChangelogEntryType].bg,
                      color: CHANGELOG_TYPE_COLORS[entry.type as ChangelogEntryType].text,
                    }}
                  >
                    {CHANGELOG_TYPE_LABELS[entry.type as ChangelogEntryType]}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: entry.published ? '#D1FAE5' : '#FEF3C7',
                      color: entry.published ? '#065F46' : '#92400E',
                    }}
                  >
                    {entry.published ? 'Publié' : 'Brouillon'}
                  </span>
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>
                    {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <h3 className="text-sm font-semibold" style={{ color: '#2C3E2D' }}>
                  {entry.title}
                </h3>
                <p className="text-sm truncate" style={{ color: '#6B7280' }}>
                  {entry.description}
                </p>
              </div>

              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <button
                  onClick={() => handleTogglePublished(entry)}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded-md"
                  style={{ color: '#6B7280', backgroundColor: '#F3F4F6' }}
                  title={entry.published ? 'Dépublier' : 'Publier'}
                >
                  {entry.published ? 'Dépublier' : 'Publier'}
                </button>
                <button
                  onClick={() => openEdit(entry)}
                  className="text-xs px-2 py-1 rounded-md"
                  style={{ color: '#1E40AF', backgroundColor: '#EFF6FF' }}
                >
                  Modifier
                </button>
                {confirmDeleteId === entry.id ? (
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={isPending}
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ color: '#991B1B', backgroundColor: '#FEE2E2' }}
                  >
                    Confirmer
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(entry.id)}
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ color: '#991B1B', backgroundColor: '#FEF2F2' }}
                  >
                    Suppr.
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

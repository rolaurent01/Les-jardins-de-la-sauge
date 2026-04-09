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
} from '@/app/[orgSlug]/(dashboard)/admin/changelog/actions'

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

  useEffect(() => { setEntries(initialEntries) }, [initialEntries])

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
  }

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: '#2C3E2D' }}>
          Gestion du changelog
        </h1>
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

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </div>
      )}

      {/* Formulaire */}
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

      {/* Liste */}
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

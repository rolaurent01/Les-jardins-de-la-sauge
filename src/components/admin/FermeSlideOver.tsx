'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import type { FarmWithRelations } from '@/app/[orgSlug]/(dashboard)/admin/fermes/actions'
import type { ActionResult, Organization } from '@/lib/types'

type Props = {
  open: boolean
  item: FarmWithRelations | null
  organizations: Pick<Organization, 'id' | 'nom' | 'max_farms'>[]
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<ActionResult>
  onSuccess: () => void
}

export default function FermeSlideOver({ open, item, organizations, onClose, onSubmit, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const firstInput = useRef<HTMLSelectElement>(null)

  const [organizationId, setOrganizationId] = useState('')
  const [nom, setNom] = useState('')
  const [slug, setSlug] = useState('')
  const [certifBio, setCertifBio] = useState(false)
  const [organismeCertificateur, setOrganismeCertificateur] = useState('')
  const [numeroCertificat, setNumeroCertificat] = useState('')

  useEffect(() => {
    if (item) {
      setOrganizationId(item.organization_id)
      setNom(item.nom)
      setSlug(item.slug)
      setCertifBio(item.certif_bio ?? false)
      setOrganismeCertificateur(item.organisme_certificateur ?? '')
      setNumeroCertificat(item.numero_certificat ?? '')
    } else {
      setOrganizationId(organizations[0]?.id ?? '')
      setNom('')
      setSlug('')
      setCertifBio(false)
      setOrganismeCertificateur('')
      setNumeroCertificat('')
    }
    setError(null)
  }, [item, open, organizations])

  useEffect(() => {
    if (open) setTimeout(() => firstInput.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, isPending, onClose])

  function handleNomChange(value: string) {
    setNom(value)
    if (!item) {
      setSlug(
        value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      )
    }
  }

  function handleSubmit() {
    setError(null)
    const fd = new FormData()
    fd.set('organization_id', organizationId)
    fd.set('nom', nom)
    fd.set('slug', slug)
    fd.set('certif_bio', certifBio ? 'true' : 'false')
    fd.set('organisme_certificateur', organismeCertificateur)
    fd.set('numero_certificat', numeroCertificat)

    startTransition(async () => {
      const result = await onSubmit(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #D8E0D9',
    fontSize: '13px',
    color: '#2C3E2D',
    backgroundColor: '#fff',
    width: '100%',
  }

  const labelStyle = {
    fontSize: '12px',
    fontWeight: 500 as const,
    color: '#6B7280',
    marginBottom: '4px',
    display: 'block',
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => !isPending && onClose()}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)',
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: '480px', zIndex: 50,
          backgroundColor: '#FAF5E9',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #E5E7EB' }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: '#2C3E2D' }}>
            {item ? 'Modifier la ferme' : 'Nouvelle ferme'}
          </h2>
          <button onClick={onClose} disabled={isPending} className="text-[18px]" style={{ color: '#9CA3AF', lineHeight: 1 }}>
            &#x2715;
          </button>
        </div>

        {/* Formulaire */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg text-[13px]" style={{ padding: '10px 14px', backgroundColor: '#FDF3E8', color: '#BC6C25' }}>
              {error}
            </div>
          )}

          {/* Organisation (uniquement en création) */}
          {!item && (
            <div>
              <label style={labelStyle}>Organisation *</label>
              <select
                ref={firstInput}
                value={organizationId}
                onChange={e => setOrganizationId(e.target.value)}
                style={inputStyle}
              >
                {organizations.map(o => (
                  <option key={o.id} value={o.id}>{o.nom}</option>
                ))}
              </select>
            </div>
          )}

          {/* Nom */}
          <div>
            <label style={labelStyle}>Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={e => handleNomChange(e.target.value)}
              style={inputStyle}
              placeholder="Ex: Ferme principale"
            />
          </div>

          {/* Slug */}
          <div>
            <label style={labelStyle}>Slug</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Séparateur Certification Bio */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px', marginTop: '8px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isPending ? 'not-allowed' : 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={certifBio}
                onChange={e => setCertifBio(e.target.checked)}
                disabled={isPending}
                style={{ accentColor: '#166534', width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#2C3E2D' }}>
                Cette ferme est certifiée Agriculture Biologique
              </span>
            </label>
          </div>

          {/* Champs conditionnels si certif_bio */}
          {certifBio && (
            <>
              <div>
                <label style={labelStyle}>Organisme certificateur</label>
                <input
                  type="text"
                  value={organismeCertificateur}
                  onChange={e => setOrganismeCertificateur(e.target.value)}
                  style={inputStyle}
                  placeholder="Ex : Ecocert, Bureau Veritas, Certipaq"
                />
              </div>
              <div>
                <label style={labelStyle}>N° certificat</label>
                <input
                  type="text"
                  value={numeroCertificat}
                  onChange={e => setNumeroCertificat(e.target.value)}
                  style={inputStyle}
                  placeholder="Numéro de certification"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg text-[13px] font-medium"
            style={{ padding: '8px 16px', color: '#4B5563', border: '1px solid #D1D5DB', backgroundColor: '#fff' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg text-[13px] font-medium text-white"
            style={{ padding: '8px 16px', backgroundColor: '#DC2626', opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? 'Enregistrement...' : item ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  )
}

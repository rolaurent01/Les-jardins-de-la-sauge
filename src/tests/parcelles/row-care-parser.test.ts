import { describe, it, expect } from 'vitest'
import { parseRowCareForm } from '@/lib/utils/parcelles-parsers'

// UUIDs v4 valides
const ROW_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const VARIETY_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

function relativeDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

const YESTERDAY = relativeDate(-1)

/** Crée un FormData minimal valide pour suivi de rang */
function makeFormData(overrides: Record<string, string> = {}): FormData {
  const defaults: Record<string, string> = {
    row_id: ROW_UUID,
    variety_id: VARIETY_UUID,
    date: YESTERDAY,
    type_soin: 'desherbage',
  }
  const fd = new FormData()
  const merged = { ...defaults, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v !== '__DELETE__') fd.set(k, v)
  }
  return fd
}

describe('parseRowCareForm', () => {
  it('devrait parser un formulaire valide complet', () => {
    const result = parseRowCareForm(makeFormData())
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.row_id).toBe(ROW_UUID)
      expect(result.data.variety_id).toBe(VARIETY_UUID)
      expect(result.data.type_soin).toBe('desherbage')
    }
  })

  it('devrait retourner variety_id = null quand le champ est vide', () => {
    const result = parseRowCareForm(makeFormData({ variety_id: '' }))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.variety_id).toBeNull()
    }
  })

  it('devrait retourner variety_id = null quand le champ est absent', () => {
    const result = parseRowCareForm(makeFormData({ variety_id: '__DELETE__' }))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.variety_id).toBeNull()
    }
  })

  it('devrait retourner variety_id = null quand le champ contient des espaces', () => {
    const result = parseRowCareForm(makeFormData({ variety_id: '   ' }))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.variety_id).toBeNull()
    }
  })

  it('devrait rejeter un variety_id non-UUID', () => {
    const result = parseRowCareForm(makeFormData({ variety_id: 'pas-un-uuid' }))
    expect('error' in result).toBe(true)
  })

  it('devrait parser temps_min valide', () => {
    const result = parseRowCareForm(makeFormData({ temps_min: '30' }))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.temps_min).toBe(30)
    }
  })

  it('devrait retourner temps_min = null quand absent', () => {
    const result = parseRowCareForm(makeFormData())
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.temps_min).toBeNull()
    }
  })

  it('devrait parser commentaire avec trim', () => {
    const result = parseRowCareForm(makeFormData({ commentaire: '  notes  ' }))
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.commentaire).toBe('notes')
    }
  })

  it('devrait retourner une erreur quand row_id est vide', () => {
    const result = parseRowCareForm(makeFormData({ row_id: '' }))
    expect('error' in result).toBe(true)
  })

  it('devrait retourner une erreur quand type_soin est invalide', () => {
    const result = parseRowCareForm(makeFormData({ type_soin: 'inconnu' }))
    expect('error' in result).toBe(true)
  })
})

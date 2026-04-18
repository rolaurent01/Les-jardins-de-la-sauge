import { describe, it, expect, beforeEach } from 'vitest'
import { resetDatabase, offlineDb } from './helpers/mock-db'
import type { CachedPlanting } from '@/lib/offline/db'

// UUIDs
const ROW_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const ROW_B = 'b1ffc210-0d1c-5f09-cc7e-7ccaae491b22'
const VAR_LAVANDE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const VAR_THYM = 'c83bd21a-67dd-4483-b882-1d1e3e4f5a6b'

const PLANTING_1: CachedPlanting = {
  id: '11111111-1111-1111-1111-111111111111',
  row_id: ROW_A,
  variety_id: VAR_LAVANDE,
  variety_name: 'Lavande vraie',
  actif: true,
  longueur_m: 6,
}

const PLANTING_2: CachedPlanting = {
  id: '22222222-2222-2222-2222-222222222222',
  row_id: ROW_A,
  variety_id: VAR_THYM,
  variety_name: 'Thym commun',
  actif: true,
  longueur_m: 8,
}

const PLANTING_3: CachedPlanting = {
  id: '33333333-3333-3333-3333-333333333333',
  row_id: ROW_B,
  variety_id: VAR_LAVANDE,
  variety_name: 'Lavande vraie',
  actif: true,
  longueur_m: 10,
}

describe('CachedPlanting — IndexedDB CRUD', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('devrait insérer et lire un planting', async () => {
    await offlineDb.plantings.add(PLANTING_1)
    const all = await offlineDb.plantings.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].variety_name).toBe('Lavande vraie')
  })

  it('devrait insérer plusieurs plantings en bulk', async () => {
    await offlineDb.plantings.bulkAdd([PLANTING_1, PLANTING_2, PLANTING_3])
    const all = await offlineDb.plantings.toArray()
    expect(all).toHaveLength(3)
  })

  it('devrait filtrer par row_id', async () => {
    await offlineDb.plantings.bulkAdd([PLANTING_1, PLANTING_2, PLANTING_3])
    const rowA = await offlineDb.plantings.where('row_id').equals(ROW_A).toArray()
    expect(rowA).toHaveLength(2)
    expect(rowA.map(p => p.variety_name).sort()).toEqual(['Lavande vraie', 'Thym commun'])
  })

  it('devrait filtrer par variety_id', async () => {
    await offlineDb.plantings.bulkAdd([PLANTING_1, PLANTING_2, PLANTING_3])
    const lavandes = await offlineDb.plantings.where('variety_id').equals(VAR_LAVANDE).toArray()
    expect(lavandes).toHaveLength(2)
    expect(lavandes.every(p => p.variety_name === 'Lavande vraie')).toBe(true)
  })

  it('devrait marquer un planting comme inactif (arrachage)', async () => {
    await offlineDb.plantings.bulkAdd([PLANTING_1, PLANTING_2])

    // Simuler un arrachage : marquer PLANTING_1 comme inactif
    await offlineDb.plantings.update(PLANTING_1.id, { actif: false })

    const updated = await offlineDb.plantings.get(PLANTING_1.id)
    expect(updated?.actif).toBe(false)

    // L'autre planting reste actif
    const other = await offlineDb.plantings.get(PLANTING_2.id)
    expect(other?.actif).toBe(true)
  })

  it('devrait marquer tous les plantings d\'un rang comme inactifs', async () => {
    await offlineDb.plantings.bulkAdd([PLANTING_1, PLANTING_2, PLANTING_3])

    // Simuler un arrachage de tout le rang A
    const rowAPlantings = await offlineDb.plantings.where('row_id').equals(ROW_A).toArray()
    for (const p of rowAPlantings) {
      await offlineDb.plantings.update(p.id, { actif: false })
    }

    const allAfter = await offlineDb.plantings.toArray()
    const rowAAfter = allAfter.filter(p => p.row_id === ROW_A)
    const rowBAfter = allAfter.filter(p => p.row_id === ROW_B)

    expect(rowAAfter.every(p => !p.actif)).toBe(true)
    expect(rowBAfter.every(p => p.actif)).toBe(true)
  })

  it('devrait ajouter un planting après plantation (simulation PlantationForm)', async () => {
    // État initial : rang B a une lavande
    await offlineDb.plantings.add(PLANTING_3)

    // Nouvelle plantation : thym sur rang B
    const newPlanting: CachedPlanting = {
      id: '44444444-4444-4444-4444-444444444444',
      row_id: ROW_B,
      variety_id: VAR_THYM,
      variety_name: 'Thym commun',
      actif: true,
      longueur_m: 5,
    }
    await offlineDb.plantings.add(newPlanting)

    const rowB = await offlineDb.plantings.where('row_id').equals(ROW_B).toArray()
    expect(rowB).toHaveLength(2)
    expect(rowB.map(p => p.variety_name).sort()).toEqual(['Lavande vraie', 'Thym commun'])
  })

  it('devrait vider la table via resetDatabase', async () => {
    await offlineDb.plantings.bulkAdd([PLANTING_1, PLANTING_2, PLANTING_3])
    expect(await offlineDb.plantings.count()).toBe(3)

    await resetDatabase()
    expect(await offlineDb.plantings.count()).toBe(0)
  })

  it('devrait construire un index varietiesByRow (logique formulaire)', async () => {
    await offlineDb.plantings.bulkAdd([PLANTING_1, PLANTING_2, PLANTING_3])

    // Reproduire la logique des formulaires mobile
    const allPlantings = await offlineDb.plantings.toArray()
    const activePlantings = allPlantings.filter(p => p.actif)
    const map = new Map<string, { id: string; name: string }[]>()

    for (const p of activePlantings) {
      const list = map.get(p.row_id) ?? []
      if (!list.some(v => v.id === p.variety_id)) {
        list.push({ id: p.variety_id, name: p.variety_name })
      }
      map.set(p.row_id, list)
    }

    // Rang A : 2 variétés (lavande + thym)
    expect(map.get(ROW_A)).toHaveLength(2)
    // Rang B : 1 variété (lavande)
    expect(map.get(ROW_B)).toHaveLength(1)
    expect(map.get(ROW_B)![0].name).toBe('Lavande vraie')
  })
})

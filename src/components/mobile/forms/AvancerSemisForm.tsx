'use client'

import { useState, useCallback } from 'react'
import { useMobileSync } from '@/components/mobile/MobileSyncContext'
import MobileFormLayout from '@/components/mobile/MobileFormLayout'
import MobileInput from '@/components/mobile/fields/MobileInput'
import MobileTimerInput from '@/components/mobile/fields/MobileTimerInput'
import MobileTextarea from '@/components/mobile/fields/MobileTextarea'
import type { CachedSeedling } from '@/lib/offline/db'
import { SEEDLING_STATUT_LABELS } from '@/lib/types'
import type { SeedlingStatut } from '@/lib/types'
import { updateCachedSeedlingOptimistic } from '@/lib/offline/seedling-cache'
import { todayISO } from '@/lib/utils/date'
import DateYearWarning from '@/components/shared/DateYearWarning'

/** Couleurs des badges statut (identiques au desktop) */
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  semis:          { bg: '#F5F2ED', color: '#6B7B6C' },
  leve:           { bg: '#DCFCE7', color: '#166534' },
  repiquage:      { bg: '#DBEAFE', color: '#1E40AF' },
  pret:           { bg: '#D1FAE5', color: '#065F46' },
  en_plantation:  { bg: '#FEF3C7', color: '#92400E' },
  epuise:         { bg: '#F5F2ED', color: '#9CA89D' },
}

interface AvancerSemisFormProps {
  seedling: CachedSeedling
  orgSlug: string
  onBack: () => void
}

/**
 * Formulaire mobile d'avancement d'un semis.
 * Affiche uniquement les champs pertinents pour l'étape suivante.
 */
export default function AvancerSemisForm({ seedling, orgSlug, onBack }: AvancerSemisFormProps) {
  const { addEntry, farmId } = useMobileSync()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Champs du formulaire
  const [dateLevee, setDateLevee] = useState(todayISO())
  const [dateRepiquage, setDateRepiquage] = useState(todayISO())
  const [nbMortesMottes, setNbMortesMottes] = useState('0')
  const [nbMortesCaissette, setNbMortesCaissette] = useState('0')
  const [nbMortesGodet, setNbMortesGodet] = useState('0')
  const [nbPlantsObtenus, setNbPlantsObtenus] = useState('')
  const [tempsRepiquageMin, setTempsRepiquageMin] = useState('')
  const [commentaire, setCommentaire] = useState('')

  const statut = seedling.statut as SeedlingStatut
  const isMiniMotte = seedling.processus === 'mini_motte'
  const isCaissetteGodet = seedling.processus === 'caissette_godet'

  // Déterminer l'action proposée selon le statut
  const action = getActionForStatut(statut, isCaissetteGodet)

  const handleSubmit = useCallback(async () => {
    setGlobalError(null)

    // Construire le payload avec uniquement les champs de l'étape
    const payload: Record<string, unknown> = { server_id: seedling.id }
    const cacheFields: Record<string, unknown> = {}

    if (action === 'levee') {
      if (!dateLevee) { setGlobalError('Date de levée requise'); return }
      payload.date_levee = dateLevee
      cacheFields.date_levee = dateLevee

      if (isMiniMotte) {
        payload.nb_mortes_mottes = parseInt(nbMortesMottes, 10) || 0
        cacheFields.nb_mortes_mottes = parseInt(nbMortesMottes, 10) || 0
      } else {
        payload.nb_mortes_caissette = parseInt(nbMortesCaissette, 10) || 0
        cacheFields.nb_mortes_caissette = parseInt(nbMortesCaissette, 10) || 0
      }
    }

    if (action === 'repiquage') {
      if (!dateRepiquage) { setGlobalError('Date de repiquage requise'); return }
      payload.date_repiquage = dateRepiquage
      cacheFields.date_repiquage = dateRepiquage
      payload.nb_mortes_godet = parseInt(nbMortesGodet, 10) || 0
      cacheFields.nb_mortes_godet = parseInt(nbMortesGodet, 10) || 0
      if (tempsRepiquageMin) {
        payload.temps_repiquage_min = parseInt(tempsRepiquageMin, 10)
        cacheFields.temps_repiquage_min = parseInt(tempsRepiquageMin, 10)
      }
    }

    if (action === 'resultats') {
      const nb = parseInt(nbPlantsObtenus, 10)
      if (isNaN(nb) || nb < 0) { setGlobalError('Nombre de plants obtenus requis'); return }
      payload.nb_plants_obtenus = nb
      cacheFields.nb_plants_obtenus = nb
    }

    if (commentaire.trim()) {
      payload.commentaire = commentaire.trim()
      cacheFields.commentaire = commentaire.trim()
    }

    setIsSubmitting(true)
    try {
      // 1. Mise à jour optimiste du cache IndexedDB
      await updateCachedSeedlingOptimistic(seedling.id, cacheFields)

      // 2. Ajout à la sync queue
      await addEntry({
        table_cible: 'seedlings_update',
        farm_id: farmId,
        payload,
      })

      setSuccess(true)
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    } finally {
      setIsSubmitting(false)
    }
  }, [action, dateLevee, dateRepiquage, nbMortesMottes, nbMortesCaissette, nbMortesGodet, nbPlantsObtenus, tempsRepiquageMin, commentaire, seedling.id, farmId, addEntry, isMiniMotte])

  const backHref = `/${orgSlug}/m/saisie/semis/avancement`
  const colors = STATUT_COLORS[statut] ?? STATUT_COLORS.semis

  return (
    <MobileFormLayout
      title="Avancer le semis"
      backHref={backHref}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      success={success}
      error={globalError}
    >
      {/* En-tête : infos du semis */}
      <div className="rounded-xl p-3" style={{ backgroundColor: '#F9F7F3' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold" style={{ color: '#2C3E2D' }}>
            {seedling.variety_name ?? 'Variété inconnue'}
          </span>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: colors.bg, color: colors.color }}
          >
            {SEEDLING_STATUT_LABELS[statut] ?? statut}
          </span>
        </div>
        <div className="text-xs" style={{ color: '#6B7B6C' }}>
          {isMiniMotte ? 'Mini-mottes' : 'Caissette/Godet'}
          {seedling.numero_caisse ? ` · Caisse ${seedling.numero_caisse}` : ''}
          {' · '}Semé le {formatDate(seedling.date_semis)}
          {seedling.nb_plants_obtenus != null && (
            <> · {seedling.nb_plants_obtenus} plants</>
          )}
        </div>
      </div>

      {/* Champs selon l'action */}
      {action === 'levee' && (
        <>
          <MobileInput
            label="Date de levée"
            required
            type="date"
            value={dateLevee}
            onChange={setDateLevee}
          />
          <DateYearWarning date={dateLevee} />
          {isMiniMotte && (
            <MobileInput
              label="Mortes avant levée"
              type="number"
              value={nbMortesMottes}
              onChange={setNbMortesMottes}
              placeholder="0"
            />
          )}
          {isCaissetteGodet && (
            <MobileInput
              label="Mortes en caissette"
              type="number"
              value={nbMortesCaissette}
              onChange={setNbMortesCaissette}
              placeholder="0"
            />
          )}
        </>
      )}

      {action === 'repiquage' && (
        <>
          <MobileInput
            label="Date de repiquage"
            required
            type="date"
            value={dateRepiquage}
            onChange={setDateRepiquage}
          />
          <DateYearWarning date={dateRepiquage} />
          <MobileInput
            label="Mortes en godet"
            type="number"
            value={nbMortesGodet}
            onChange={setNbMortesGodet}
            placeholder="0"
          />
          <MobileTimerInput
            label="Temps repiquage"
            value={tempsRepiquageMin}
            onChange={setTempsRepiquageMin}
          />
        </>
      )}

      {action === 'resultats' && (
        <MobileInput
          label="Plants obtenus"
          required
          type="number"
          value={nbPlantsObtenus}
          onChange={setNbPlantsObtenus}
          placeholder="ex : 45"
        />
      )}

      {action === 'done' && (
        <div className="text-sm text-center py-4" style={{ color: '#6B7B6C' }}>
          Ce semis est déjà à l'étape finale ({SEEDLING_STATUT_LABELS[statut]}).
        </div>
      )}

      <MobileTextarea
        label="Commentaire"
        value={commentaire}
        onChange={setCommentaire}
        placeholder="Notes, observations…"
      />
    </MobileFormLayout>
  )
}

// --- Helpers ---

type Action = 'levee' | 'repiquage' | 'resultats' | 'done'

/** Détermine l'action d'avancement selon le statut courant */
function getActionForStatut(statut: SeedlingStatut, isCaissetteGodet: boolean): Action {
  switch (statut) {
    case 'semis':
      return 'levee'
    case 'leve':
      return isCaissetteGodet ? 'repiquage' : 'resultats'
    case 'repiquage':
      return 'resultats'
    case 'pret':
    case 'en_plantation':
    case 'epuise':
      return 'done'
    default:
      return 'done'
  }
}

/** Formate une date ISO en JJ/MM/AAAA */
function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

'use client'

import { useState, useCallback } from 'react'

type SwitchGuardState = {
  /** Afficher la modale d'alerte */
  showAlert: boolean
  /** Nombre de saisies en attente */
  pendingCount: number
  /** ID de la ferme cible */
  targetFarmId: string | null
  /** Nom de la ferme cible */
  targetFarmName: string
}

/**
 * Hook partagé : vérifie la syncQueue avant un changement de ferme.
 * Retourne les props nécessaires pour afficher FarmSwitchAlert.
 */
export function useFarmSwitchGuard(isMobile: boolean) {
  const [state, setState] = useState<SwitchGuardState>({
    showAlert: false,
    pendingCount: 0,
    targetFarmId: null,
    targetFarmName: '',
  })

  /** Compte les entrées non synced dans la queue IndexedDB */
  async function countPending(): Promise<number> {
    try {
      const { offlineDb } = await import('@/lib/offline/db')
      return await offlineDb.syncQueue.where('status').noneOf(['synced']).count()
    } catch {
      // Dexie indisponible (SSR, erreur) → 0
      return 0
    }
  }

  /** Effectue le changement de ferme (cookie + reload) */
  function doSwitch(farmId: string) {
    document.cookie = `active_farm_id=${farmId}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`
    window.location.reload()
  }

  /**
   * Appelé avant de changer de ferme.
   * - Bureau + queue vide → switch immédiat
   * - Mobile ou queue non vide → affiche l'alerte
   */
  const checkBeforeSwitch = useCallback(
    async (targetFarmId: string, targetFarmName: string) => {
      const pending = await countPending()

      if (!isMobile && pending === 0) {
        // Bureau sans saisie en attente → changement direct
        doSwitch(targetFarmId)
        return
      }

      // Afficher la modale
      setState({
        showAlert: true,
        pendingCount: pending,
        targetFarmId,
        targetFarmName,
      })
    },
    [isMobile],
  )

  const dismissAlert = useCallback(() => {
    setState(s => ({ ...s, showAlert: false, targetFarmId: null }))
  }, [])

  const confirmSwitch = useCallback(() => {
    if (state.targetFarmId) {
      doSwitch(state.targetFarmId)
    }
  }, [state.targetFarmId])

  return {
    showAlert: state.showAlert,
    pendingCount: state.pendingCount,
    targetFarmName: state.targetFarmName,
    checkBeforeSwitch,
    dismissAlert,
    confirmSwitch,
  }
}

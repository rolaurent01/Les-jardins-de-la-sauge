'use client'

import { useFarmSwitchGuard } from '@/hooks/useFarmSwitchGuard'
import FarmSwitchAlert from './FarmSwitchAlert'

type Farm = { id: string; nom: string }

type Props = {
  farms: Farm[]
  activeFarmId: string
}

/**
 * Sélecteur de ferme active — affiché dans la sidebar si l'utilisateur a accès à plusieurs fermes.
 * Vérifie la syncQueue avant de changer : si des saisies sont en attente, affiche une alerte.
 */
export default function FarmSelector({ farms, activeFarmId }: Props) {
  const guard = useFarmSwitchGuard(false)

  // Aucun sélecteur si une seule ferme ou aucune
  if (farms.length <= 1) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newFarmId = e.target.value
    if (newFarmId === activeFarmId) return
    const targetFarm = farms.find(f => f.id === newFarmId)
    guard.checkBeforeSwitch(newFarmId, targetFarm?.nom ?? '')
  }

  return (
    <div className="px-3 py-2">
      <label className="sr-only" htmlFor="farm-selector">
        Ferme active
      </label>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: '12px', opacity: 0.6 }}>🏡</span>
        <select
          id="farm-selector"
          value={activeFarmId}
          onChange={handleChange}
          className="flex-1 text-[12px] rounded-md px-2 py-1 outline-none cursor-pointer"
          style={{
            backgroundColor: 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          {farms.map(farm => (
            <option key={farm.id} value={farm.id} style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
              {farm.nom}
            </option>
          ))}
        </select>
      </div>

      {guard.showAlert && (
        <FarmSwitchAlert
          pendingCount={guard.pendingCount}
          isMobile={false}
          targetFarmName={guard.targetFarmName}
          onCancel={guard.dismissAlert}
          onConfirm={guard.confirmSwitch}
        />
      )}
    </div>
  )
}

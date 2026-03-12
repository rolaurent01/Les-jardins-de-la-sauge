'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFarmSwitchGuard } from '@/hooks/useFarmSwitchGuard'
import FarmSwitchAlert from '@/components/layout/FarmSwitchAlert'

type Farm = { id: string; nom: string }

type Props = {
  farms: Farm[]
  activeFarmId: string
}

/**
 * Sélecteur de ferme mobile — affiché dans le header vert si 2+ fermes.
 * Au tap → bottom-sheet avec la liste des fermes.
 * Alerte de confirmation avant le changement (sync queue + cache).
 */
export default function MobileFarmSelector({ farms, activeFarmId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const guard = useFarmSwitchGuard(true)

  // Masqué si une seule ferme
  if (farms.length <= 1) return null

  const activeFarm = farms.find(f => f.id === activeFarmId)

  function handleSelectFarm(farm: Farm) {
    if (farm.id === activeFarmId) {
      setIsOpen(false)
      return
    }
    setIsOpen(false)
    guard.checkBeforeSwitch(farm.id, farm.nom)
  }

  return (
    <>
      {/* Bouton dans le header */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: 0,
        }}
      >
        <span style={{ fontSize: '13px' }}>🌿</span>
        <span>{activeFarm?.nom ?? 'Ferme'}</span>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
      </button>

      {/* Bottom-sheet de sélection */}
      {isOpen && (
        <BottomSheet onClose={() => setIsOpen(false)}>
          <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '12px', color: '#2C3E2D' }}>
            Choisir une ferme
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {farms.map(farm => (
              <button
                key={farm.id}
                onClick={() => handleSelectFarm(farm)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: '48px',
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: farm.id === activeFarmId ? 'rgba(76,110,60,0.08)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: '#2C3E2D',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <span>{farm.nom}</span>
                {farm.id === activeFarmId && (
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Alerte de changement de ferme */}
      {guard.showAlert && (
        <FarmSwitchAlert
          pendingCount={guard.pendingCount}
          isMobile={true}
          targetFarmName={guard.targetFarmName}
          onCancel={guard.dismissAlert}
          onConfirm={guard.confirmSwitch}
        />
      )}
    </>
  )
}

/** Bottom-sheet minimaliste (slide du bas) */
function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Fermer avec Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Empêcher le scroll du body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 9990,
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9991,
          backgroundColor: '#fff',
          borderRadius: '16px 16px 0 0',
          padding: '20px 16px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Poignée */}
        <div
          style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: '#ddd',
            margin: '0 auto 16px',
          }}
        />
        {children}
      </div>
    </>
  )
}

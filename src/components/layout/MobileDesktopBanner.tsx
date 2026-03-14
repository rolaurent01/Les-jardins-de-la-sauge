'use client'

import { useState, useEffect } from 'react'

/**
 * Bandeau affiché en haut du layout bureau quand l'écran est petit (< 768px).
 * Propose de basculer en mode terrain. Supprime le cookie force_desktop au clic.
 * Fermable avec ✕ mais revient au prochain chargement.
 */
export default function MobileDesktopBanner({ orgSlug }: { orgSlug: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Détection côté client uniquement (pas User-Agent)
    function check() {
      setVisible(window.innerWidth < 768)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!visible) return null

  function handleSwitch() {
    // Supprimer le cookie force_desktop
    document.cookie = 'force_desktop=; path=/; max-age=0'
    window.location.href = `/${orgSlug}/m/saisie`
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(76,110,60,0.12)',
        borderBottom: '1px solid rgba(76,110,60,0.2)',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: '14px',
        color: '#2C3E2D',
        position: 'relative',
      }}
    >
      <span>Vous êtes sur la version bureau. </span>
      <button
        onClick={handleSwitch}
        style={{
          fontWeight: 700,
          color: 'var(--color-primary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          fontSize: '14px',
          padding: 0,
        }}
      >
        Passer en mode terrain
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Fermer le bandeau"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          color: '#666',
          padding: '4px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}

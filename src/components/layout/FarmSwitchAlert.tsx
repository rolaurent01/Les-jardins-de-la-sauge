'use client'

import { useEffect } from 'react'

type Props = {
  /** Nombre de saisies en attente de sync */
  pendingCount: number
  /** true = mobile (confirmation même si queue vide) */
  isMobile: boolean
  /** Nom de la ferme cible */
  targetFarmName: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Modale d'alerte affichée avant un changement de ferme.
 * - Bureau queue vide → pas affichée (le parent gère le switch direct)
 * - Bureau queue non vide → alerte sync
 * - Mobile queue vide → confirmation "cache rechargé"
 * - Mobile queue non vide → alerte sync
 */
export default function FarmSwitchAlert({
  pendingCount,
  isMobile: _isMobile,
  targetFarmName,
  onCancel,
  onConfirm,
}: Props) {
  // Fermer avec Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const hasPending = pendingCount > 0

  return (
    <>
      {/* Overlay sombre */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
        }}
      />

      {/* Modale */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            maxWidth: '420px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            color: '#2C3E2D',
          }}
        >
          {hasPending ? (
            <>
              <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '12px' }}>
                ⚠️ {pendingCount} saisie{pendingCount > 1 ? 's' : ''} en attente de synchronisation
              </p>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '8px' }}>
                Vos saisies n&apos;ont pas encore été envoyées au serveur.
                Si vous changez de ferme sans connexion internet,
                le cache sera rechargé et les formulaires afficheront
                les données de la nouvelle ferme.
              </p>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '20px' }}>
                👉 Connectez-vous au Wi-Fi et attendez que la barre
                de sync affiche &quot;✅ Tout synchronisé&quot; avant de changer.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '12px' }}>
                Changer vers {targetFarmName} ?
              </p>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '20px' }}>
                Le cache des données de référence va être rechargé.
                Vous devez être connecté à internet.
              </p>
            </>
          )}

          {/* Boutons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {hasPending ? (
              <>
                {/* Bouton secondaire — changer quand même */}
                <button
                  onClick={onConfirm}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    backgroundColor: '#fff',
                    color: '#666',
                    cursor: 'pointer',
                  }}
                >
                  Je comprends, changer quand même
                </button>
                {/* Bouton principal — annuler */}
                <button
                  onClick={onCancel}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Annuler — rester sur cette ferme
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onCancel}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    backgroundColor: '#fff',
                    color: '#666',
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={onConfirm}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Changer de ferme
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

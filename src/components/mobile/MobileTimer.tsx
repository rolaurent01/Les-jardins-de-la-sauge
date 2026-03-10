'use client'

import { useCallback, useState } from 'react'
import { useTimer } from './TimerContext'

/** Formate les secondes en MM:SS */
function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Chronomètre flottant mobile — bouton discret en bas à droite.
 * Au tap : ouvre un mini-panneau avec start/stop/reset/copier.
 * Pulse doucement quand le timer tourne.
 * Survit à la navigation grâce au TimerContext.
 */
export default function MobileTimer() {
  const timer = useTimer()
  const [panelOpen, setPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!timer) return
    const minutes = timer.elapsedMinutes
    try {
      await navigator.clipboard.writeText(String(minutes))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API indisponible
    }
  }, [timer])

  // Pas de timer context → ne rien rendre
  if (!timer) return null

  return (
    <div
      className="fixed"
      style={{ bottom: 16, right: 16, zIndex: 80 }}
    >
      {/* Mini-panneau au-dessus du bouton */}
      {panelOpen && (
        <div
          className="mb-2 p-3 rounded-xl flex flex-col items-center gap-3"
          style={{
            backgroundColor: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            minWidth: 180,
          }}
        >
          {/* Affichage du temps */}
          <span
            className="font-mono font-bold"
            style={{ fontSize: 24, color: '#2C3E2D' }}
          >
            {formatTime(timer.elapsedSeconds)}
          </span>

          {/* Minutes arrondies */}
          <span className="text-xs" style={{ color: '#6B7280' }}>
            ≈ {timer.elapsedMinutes} min
          </span>

          {/* Boutons */}
          <div className="flex gap-2 w-full">
            {!timer.isRunning ? (
              <TimerButton
                onClick={timer.start}
                bgColor="var(--color-primary)"
                textColor="#fff"
              >
                ▶ Start
              </TimerButton>
            ) : (
              <TimerButton
                onClick={timer.stop}
                bgColor="#F59E0B"
                textColor="#fff"
              >
                ⏸ Stop
              </TimerButton>
            )}
            <TimerButton
              onClick={timer.reset}
              bgColor="#F3F4F6"
              textColor="#374151"
            >
              ↺ Reset
            </TimerButton>
          </div>

          {/* Copier */}
          {timer.isStarted && (
            <button
              type="button"
              onClick={handleCopy}
              className="w-full text-xs font-medium py-2 rounded-lg"
              style={{
                backgroundColor: copied ? '#DCFCE7' : '#F9FAFB',
                color: copied ? '#166534' : '#6B7280',
                border: '1px solid #E5E7EB',
              }}
            >
              {copied ? '✅ Copié !' : '📋 Copier les minutes'}
            </button>
          )}
        </div>
      )}

      {/* Bouton flottant principal */}
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="flex items-center justify-center rounded-full text-white"
        style={{
          width: 48,
          height: 48,
          backgroundColor: 'var(--color-primary)',
          border: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: 20,
          animation: timer.isRunning ? 'timer-pulse 2s ease-in-out infinite' : 'none',
          marginLeft: 'auto',
        }}
      >
        ⏱️
      </button>

      {/* Animation pulse */}
      <style>{`
        @keyframes timer-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </div>
  )
}

/** Petit bouton utilitaire du panneau timer */
function TimerButton({
  onClick,
  bgColor,
  textColor,
  children,
}: {
  onClick: () => void
  bgColor: string
  textColor: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 text-xs font-medium py-2 rounded-lg"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        border: 'none',
        minHeight: 36,
      }}
    >
      {children}
    </button>
  )
}

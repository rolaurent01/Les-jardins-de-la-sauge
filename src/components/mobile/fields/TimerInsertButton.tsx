'use client'

import { useTimer } from '@/components/mobile/TimerContext'

interface TimerInsertButtonProps {
  /** Callback pour insérer la valeur du timer (en minutes, arrondie) */
  onInsert: (minutes: string) => void
}

/**
 * Bouton "Insérer" qui insère la valeur courante du timer dans un champ temps.
 * Affiché uniquement si le timer a été démarré au moins une fois.
 */
export default function TimerInsertButton({ onInsert }: TimerInsertButtonProps) {
  const timer = useTimer()

  if (!timer || !timer.isStarted) return null

  const minutes = Math.round(timer.elapsedSeconds / 60)

  return (
    <button
      type="button"
      onClick={() => onInsert(String(minutes))}
      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: 'var(--color-primary)',
        color: '#fff',
        opacity: minutes === 0 ? 0.5 : 1,
      }}
      title={`Insérer ${minutes} min depuis le timer`}
    >
      <span>⏱️</span>
      <span>{minutes} min</span>
    </button>
  )
}

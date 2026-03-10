'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import MobileField from './MobileField'

interface MobileTimerInputProps {
  label: string
  /** Valeur en minutes (string car FormData) */
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
}

/** Formate les secondes en MM:SS */
function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Champ "Temps" avec chronomètre intégré.
 * 3 états : saisie manuelle, timer en cours, timer arrêté (valeur insérée).
 */
export default function MobileTimerInput({
  label,
  value,
  onChange,
  error,
  required,
}: MobileTimerInputProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Nettoyage de l'intervalle au démontage
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Gestion de l'intervalle selon isRunning
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning])

  const handleStart = useCallback(() => {
    setElapsedSeconds(0)
    setIsRunning(true)
  }, [])

  const handleStop = useCallback(() => {
    setIsRunning(false)
    const minutes = Math.ceil(elapsedSeconds / 60)
    onChange(String(minutes))
  }, [elapsedSeconds, onChange])

  const handleReset = useCallback(() => {
    setIsRunning(false)
    setElapsedSeconds(0)
    onChange('')
  }, [onChange])

  return (
    <MobileField label={label} required={required} error={error}>
      <div className="relative">
        {isRunning ? (
          /* État 2 — Timer en cours */
          <div
            className="w-full flex items-center font-mono"
            style={{
              height: 48,
              borderRadius: 10,
              border: '1px solid #F59E0B',
              fontSize: 16,
              paddingLeft: 12,
              paddingRight: 52,
              color: '#2C3E2D',
              backgroundColor: '#FEF3C7',
              animation: 'timer-field-pulse 2s ease-in-out infinite',
            }}
          >
            {formatTime(elapsedSeconds)}
          </div>
        ) : (
          /* État 1 ou 3 — Saisie manuelle / après stop */
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            className="w-full bg-white"
            style={{
              height: 48,
              borderRadius: 10,
              border: '1px solid #E5E5E5',
              fontSize: 16,
              paddingLeft: 12,
              paddingRight: value ? 80 : 52,
              color: '#2C3E2D',
            }}
          />
        )}

        {/* Suffix "min" (visible uniquement hors timer) */}
        {!isRunning && (
          <span
            className="absolute right-10 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: '#999' }}
          >
            min
          </span>
        )}

        {/* Bouton reset ✕ (visible si valeur présente et timer arrêté) */}
        {!isRunning && value && (
          <button
            type="button"
            onClick={handleReset}
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              right: 48,
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#F3F4F6',
              border: 'none',
              color: '#6B7280',
              fontSize: 12,
            }}
          >
            ✕
          </button>
        )}

        {/* Bouton ⏱️ / ⏹️ */}
        <button
          type="button"
          onClick={isRunning ? handleStop : handleStart}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: 'none',
            backgroundColor: isRunning ? '#DC2626' : 'transparent',
            color: isRunning ? '#fff' : '#6B7280',
            fontSize: 18,
          }}
        >
          {isRunning ? '⏹️' : '⏱️'}
        </button>
      </div>

      {/* Animation pulse pour le timer actif */}
      {isRunning && (
        <style>{`
          @keyframes timer-field-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
          }
        `}</style>
      )}
    </MobileField>
  )
}

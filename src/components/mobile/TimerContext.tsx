'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface TimerContextValue {
  /** Temps écoulé en secondes */
  elapsedSeconds: number
  /** Timer actif (en train de tourner) */
  isRunning: boolean
  /** Timer démarré au moins une fois (même si stoppé) */
  isStarted: boolean
  /** Valeur courante en minutes (arrondie) */
  elapsedMinutes: number
  start: () => void
  stop: () => void
  reset: () => void
}

const TimerContext = createContext<TimerContextValue | null>(null)

/**
 * Provider pour le chronomètre mobile.
 * Persiste l'état à travers la navigation (monté au niveau MobileShell).
 */
export function TimerProvider({ children }: { children: ReactNode }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Démarrer le timer
  const start = useCallback(() => {
    setIsRunning(true)
    setIsStarted(true)
  }, [])

  // Stopper le timer
  const stop = useCallback(() => {
    setIsRunning(false)
  }, [])

  // Remettre à zéro
  const reset = useCallback(() => {
    setIsRunning(false)
    setIsStarted(false)
    setElapsedSeconds(0)
  }, [])

  // Incrémenter chaque seconde quand le timer tourne
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

  const elapsedMinutes = Math.round(elapsedSeconds / 60)

  return (
    <TimerContext value={{
      elapsedSeconds,
      isRunning,
      isStarted,
      elapsedMinutes,
      start,
      stop,
      reset,
    }}>
      {children}
    </TimerContext>
  )
}

/**
 * Hook pour accéder au chronomètre mobile.
 * Retourne null si utilisé hors du TimerProvider (au lieu de throw).
 */
export function useTimer(): TimerContextValue | null {
  return useContext(TimerContext)
}

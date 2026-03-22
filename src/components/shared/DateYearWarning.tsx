'use client'

/**
 * Avertissement affiché sous un champ date quand la date est dans une année passée
 * ou dans une année clôturée. Ne bloque pas la saisie.
 */
export default function DateYearWarning({
  date,
  closedYears = [],
}: {
  date: string | null | undefined
  closedYears?: number[]
}) {
  if (!date) return null

  const year = new Date(date).getFullYear()
  if (isNaN(year)) return null

  const currentYear = new Date().getFullYear()
  const isClosed = closedYears.includes(year)
  const isPastYear = year < currentYear

  if (!isPastYear && !isClosed) return null

  return (
    <div
      className="text-xs px-3 py-2 rounded-lg mt-1"
      style={{
        backgroundColor: isClosed ? '#FFEDD5' : '#FEF3C7',
        color: isClosed ? '#9A3412' : '#92400E',
        border: `1px solid ${isClosed ? '#EA580C44' : '#F59E0B44'}`,
      }}
    >
      {isClosed
        ? `⚠️ L'année ${year} est clôturée. Les modifications restent possibles mais impacteront un exercice fermé.`
        : `⚠️ Cette date concerne l'année ${year} (année antérieure). Vérifiez que c'est intentionnel.`}
    </div>
  )
}

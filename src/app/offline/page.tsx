'use client'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
      <div className="text-6xl mb-6" aria-hidden="true">
        📴
      </div>
      <h1 className="text-2xl font-semibold text-anthracite mb-3">
        Hors ligne
      </h1>
      <p className="text-text max-w-sm mb-6 leading-relaxed">
        Vous n&apos;avez pas de connexion internet. Vos saisies en attente
        seront envoy&eacute;es automatiquement au retour du r&eacute;seau.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg bg-sage-deep px-6 py-3 text-white font-medium hover:bg-sage transition-colors"
      >
        R&eacute;essayer
      </button>
      <p className="text-muted text-sm mt-8 max-w-xs">
        Astuce : visitez les pages de saisie une fois en Wi-Fi pour
        qu&apos;elles soient disponibles hors ligne.
      </p>
    </div>
  )
}

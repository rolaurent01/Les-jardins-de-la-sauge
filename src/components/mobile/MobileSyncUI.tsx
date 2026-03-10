'use client'

import { useState } from 'react'
import SyncBar from './SyncBar'
import SyncPanel from './SyncPanel'

/**
 * Composant client regroupant SyncBar + SyncPanel.
 * Gère l'ouverture/fermeture du panneau de détail.
 * Rendu dans le MobileShell (inside MobileSyncContext).
 */
export default function MobileSyncUI() {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <>
      <SyncBar onTap={() => setPanelOpen(true)} />
      <SyncPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}

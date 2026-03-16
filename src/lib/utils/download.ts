/**
 * Télécharge un Blob sous forme de fichier via un lien temporaire.
 * Utilisé par les exports CSV/XLSX.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

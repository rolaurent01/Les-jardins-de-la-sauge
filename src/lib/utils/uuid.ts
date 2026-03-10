/**
 * Génère un UUID v4 côté client.
 * Utilise crypto.randomUUID() avec fallback sur crypto.getRandomValues().
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback pour environnements sans randomUUID (anciens navigateurs)
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // Version 4 (bits 6-7 de l'octet 8 = 10, bits 4-7 de l'octet 6 = 0100)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

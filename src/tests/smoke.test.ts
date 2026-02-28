/**
 * Test de smoke — vérifie que l'environnement Vitest est correctement configuré.
 */
describe('Environnement Vitest', () => {
  it('devrait être opérationnel', () => {
    expect(true).toBe(true)
  })

  it('devrait avoir accès aux globals de test', () => {
    expect(typeof describe).toBe('function')
    expect(typeof it).toBe('function')
    expect(typeof expect).toBe('function')
  })
})

'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await login(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#F9F8F6' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/Carnet culture sans fond.png"
            alt="Carnet Culture"
            width={200}
            height={120}
            priority
            className="object-contain"
          />
        </div>

        {/* Carte */}
        <div
          className="rounded-xl p-8 shadow-sm border"
          style={{
            backgroundColor: '#FAF5E9',
            borderColor: '#D8E0D9',
          }}
        >
          <h2
            className="text-base font-medium mb-6"
            style={{ color: '#2C3E2D' }}
          >
            Connexion
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#2C3E2D' }}
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
                className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors"
                style={{
                  backgroundColor: '#F9F8F6',
                  borderColor: '#D8E0D9',
                  color: '#2C3E2D',
                }}
                onFocus={e => (e.target.style.borderColor = '#3A5A40')}
                onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
                placeholder="vous@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#2C3E2D' }}
              >
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
                className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors"
                style={{
                  backgroundColor: '#F9F8F6',
                  borderColor: '#D8E0D9',
                  color: '#2C3E2D',
                }}
                onFocus={e => (e.target.style.borderColor = '#3A5A40')}
                onBlur={e => (e.target.style.borderColor = '#D8E0D9')}
                placeholder="••••••••"
              />
            </div>

            {/* Erreur */}
            {error && (
              <div
                className="text-sm px-3 py-2.5 rounded-lg"
                style={{
                  backgroundColor: '#FDF3E8',
                  color: '#BC6C25',
                  border: '1px solid #DDA15E44',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 text-sm font-medium rounded-lg transition-opacity mt-2"
              style={{
                backgroundColor: '#3A5A40',
                color: '#F9F8F6',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

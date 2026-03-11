'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/supabase/types'

export async function login(formData: FormData): Promise<{ error: string } | never> {
  const cookieStore = await cookies()

  // Client Supabase inline — PAS de try/catch sur setAll pour détecter les erreurs
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error || !authData.user) {
    return { error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' }
  }

  // Récupérer la première organisation pour l'URL de redirection.
  // Client admin car les cookies de session ne sont pas encore lisibles via RLS.
  let redirectPath: string | null = null
  try {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('memberships')
      .select('organizations(slug)')
      .eq('user_id', authData.user.id)
      .limit(1)
      .single()

    const orgSlug = (membership?.organizations as { slug: string } | null)?.slug
    if (orgSlug) {
      redirectPath = `/${orgSlug}/dashboard`
    }
  } catch {
    // Erreur réseau ou DB — on laisse redirectPath à null
  }

  if (!redirectPath) {
    return { error: 'Aucune organisation associée à ce compte. Contactez un administrateur.' }
  }

  // redirect() lance une exception NEXT_REDIRECT — il doit être EN DEHORS du try/catch
  redirect(redirectPath)
}

export async function logout(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error || !authData.user) {
    return { error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' }
  }

  // Récupérer la première organisation de l'utilisateur pour construire l'URL de redirection
  const { data: membership } = await supabase
    .from('memberships')
    .select('organizations(slug)')
    .eq('user_id', authData.user.id)
    .limit(1)
    .single()

  const orgSlug = (membership?.organizations as { slug: string } | null)?.slug

  if (!orgSlug) {
    // L'utilisateur n'a pas d'organisation — cas anormal (onboarding manquant)
    return { error: 'Aucune organisation associée à ce compte. Contactez un administrateur.' }
  }

  redirect(`/${orgSlug}/dashboard`)
}

export async function logout(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

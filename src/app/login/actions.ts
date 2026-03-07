'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  // --- DEBUG TEMPORAIRE (à retirer après diagnostic) ---
  console.log('[LOGIN]', {
    success: !error,
    error: error?.message || null,
    userId: authData?.user?.id?.slice(0, 8) || null,
  })

  if (error || !authData.user) {
    return { error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' }
  }

  // Récupérer la première organisation de l'utilisateur pour construire l'URL de redirection.
  // On utilise le client admin (service role) car les cookies de session ne sont pas encore
  // lisibles dans la même requête — auth.uid() retourne NULL dans les politiques RLS.
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

  console.log('[LOGIN] redirectPath:', redirectPath)

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

'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: 'Identifiants incorrects. Vérifiez votre email et mot de passe.' }
  }

  redirect('/dashboard')
}

export async function logout(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

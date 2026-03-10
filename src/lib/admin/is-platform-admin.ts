import { createAdminClient } from '@/lib/supabase/server'

/**
 * Vérifie si le userId est dans platform_admins.
 * Utilise createAdminClient() (bypass RLS car platform_admins est restreint super admin).
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single()

  return !!data
}

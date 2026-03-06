import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

/**
 * Proxy d'authentification + résolution du slug d'organisation (Next.js 16).
 *
 * Logique :
 * 1. Page /login → publique (passe-travers)
 * 2. Vérifie l'authentification Supabase
 * 3. / (racine) → redirect vers /{orgSlug}/dashboard
 * 4. /{slug}/... → vérifie que le slug existe et que l'utilisateur est membre
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  // Page de login — publique
  if (pathname === '/login') {
    return response
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Vérification d'authentification
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirection de la racine vers la première organisation de l'utilisateur
  if (pathname === '/') {
    const orgSlug = await resolveFirstOrgSlug(supabase, user.id)
    if (!orgSlug) return NextResponse.redirect(new URL('/login', request.url))
    return NextResponse.redirect(new URL(`/${orgSlug}/dashboard`, request.url))
  }

  // Vérification du slug d'organisation dans le path
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0) {
    const potentialSlug = segments[0]

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', potentialSlug)
      .single()

    if (!org) {
      const orgSlug = await resolveFirstOrgSlug(supabase, user.id)
      if (!orgSlug) return NextResponse.redirect(new URL('/login', request.url))
      return NextResponse.redirect(new URL(`/${orgSlug}/dashboard`, request.url))
    }

    // Vérifier l'appartenance à cette organisation
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      const orgSlug = await resolveFirstOrgSlug(supabase, user.id)
      if (!orgSlug) return NextResponse.redirect(new URL('/login', request.url))
      return NextResponse.redirect(new URL(`/${orgSlug}/dashboard`, request.url))
    }
  }

  return response
}

/** Résout le slug de la première organisation accessible à l'utilisateur */
async function resolveFirstOrgSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('memberships')
    .select('organizations(slug)')
    .eq('user_id', userId)
    .limit(1)
    .single()

  return (data?.organizations as { slug: string } | null)?.slug ?? null
}

export const config = {
  // Exclure les assets statiques, les routes API internes et les fichiers PWA
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|.*\\.png|.*\\.ico|.*\\.svg).*)',
  ],
}

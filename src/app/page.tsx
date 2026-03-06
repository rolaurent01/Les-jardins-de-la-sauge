import { redirect } from 'next/navigation'

// Le middleware gère la redirection :
// - Si non authentifié → /login
// - Si authentifié → /{orgSlug}/dashboard
// Cette page ne sera jamais rendue grâce au middleware, mais on garde le redirect
// comme filet de sécurité.
export default function Home() {
  redirect('/login')
}

import { redirect } from 'next/navigation'

// Le middleware gère la redirection /login si non authentifié.
// Si authentifié, on atterrit ici → on va au dashboard.
export default function Home() {
  redirect('/dashboard')
}

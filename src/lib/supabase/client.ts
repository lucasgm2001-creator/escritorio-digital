import { createBrowserClient } from '@supabase/ssr'

function newBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

let browserClient: ReturnType<typeof newBrowserClient> | null = null

export function createClient() {
  // Uma única instância por aba. Evita recriar auth listeners, canais e caches internos a cada render
  // dos muitos componentes client-side que usam Supabase.
  if (!browserClient) {
    browserClient = newBrowserClient()
  }
  return browserClient
}

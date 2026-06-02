import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // Parte do SQL que a API REST permite: garante Daniel = admin (idempotente).
  const { error: upErr } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', 'daniel@drgrowth.com')
  if (upErr) console.error('update daniel error:', upErr.message)

  // Equivalente ao SELECT final da migration.
  const { data, error } = await admin
    .from('profiles')
    .select('email, name, role')
    .order('name')
  if (error) {
    console.error('select error:', error.message)
    process.exit(1)
  }

  const rows = data ?? []
  const w = { email: Math.max(5, ...rows.map(r => (r.email ?? '').length)), name: Math.max(4, ...rows.map(r => (r.name ?? '').length)), role: Math.max(4, ...rows.map(r => (r.role ?? '').length)) }
  const pad = (s: string, n: number) => s.padEnd(n)
  const line = () => `+-${'-'.repeat(w.email)}-+-${'-'.repeat(w.name)}-+-${'-'.repeat(w.role)}-+`
  console.log(line())
  console.log(`| ${pad('email', w.email)} | ${pad('name', w.name)} | ${pad('role', w.role)} |`)
  console.log(line())
  for (const r of rows) console.log(`| ${pad(r.email ?? '', w.email)} | ${pad(r.name ?? '', w.name)} | ${pad(r.role ?? '', w.role)} |`)
  console.log(line())

  process.exit(0)
}

main()

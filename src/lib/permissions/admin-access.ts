import { roleByKey } from '@/lib/people/catalog'

// ACESSO À ADMINISTRAÇÃO (ACCESS-ROLES-001) — FONTE ÚNICA, nada hardcoded fora do catálogo.
// Regra: OWNER (autoridade da conta) OU qualquer CARGO com `adminAccess` no catálogo (ex.: Desenvolvedor).
// Todo o resto NÃO acessa — nem o role 'admin' sozinho, nem override de módulo, nem cargo comum. Usada no
// guard do /admin, na visibilidade da navegação e nas actions administrativas. Um único ponto de verdade.
export function canAccessAdmin(input: { role?: string | null; roleKeys?: string[] | null }): boolean {
  if (input.role === 'owner') return true
  return (input.roleKeys ?? []).some(key => roleByKey(key)?.adminAccess === true)
}

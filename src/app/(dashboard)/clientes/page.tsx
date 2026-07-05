import { redirect } from 'next/navigation'

// Clientes deixou de ser andar principal (CLIENT-HISTORY-ADMIN-003): a LISTA agora vive em Administração →
// Clientes (/admin/clientes). Mantemos /clientes como redirect permanente para não quebrar links, bookmarks e
// atalhos antigos. O Workspace do cliente (/clientes/[id] e subrotas) é rota PRÓPRIA — não passa por aqui e
// segue 100% intacto, com seu requireModuleEntry('clientes').
export default function ClientesIndexRedirect() {
  redirect('/admin/clientes')
}

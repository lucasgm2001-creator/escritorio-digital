import { StudioGate } from './StudioGate'
import { getRequestContext } from '@/server/context/request-context'

// Studio de Apresentação — andar próprio (saiu de dentro do Comercial). No desktop renderiza o
// Studio (ApresentacaoTab) igual a hoje; no mobile (<1024px) mostra um aviso (ver StudioGate).
export default async function StudioPage() {
  const context = await getRequestContext()
  return <StudioGate activeTeamId={context?.activeTeamId ?? null} />
}

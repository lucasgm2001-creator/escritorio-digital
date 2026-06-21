import { StudioGate } from './StudioGate'

// Studio de Apresentação — andar próprio (saiu de dentro do Comercial). No desktop renderiza o
// Studio (ApresentacaoTab) igual a hoje; no mobile (<1024px) mostra um aviso (ver StudioGate).
export default function StudioPage() {
  return <StudioGate />
}

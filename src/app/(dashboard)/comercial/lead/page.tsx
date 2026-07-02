import { Users } from 'lucide-react'

// Índice do Master → Detail: sem lead selecionado. No mobile a lista ocupa a tela (este estado fica
// oculto); no desktop aparece ao lado da lista.
export default function LeadIndexPage() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center text-center min-h-[60vh] gap-3">
      <div className="w-12 h-12 rounded-2xl bg-bento-panel border border-bento-border flex items-center justify-center">
        <Users className="w-6 h-6 text-bento-dim" />
      </div>
      <p className="text-sm text-bento-muted">Selecione um lead para ver o perfil completo.</p>
    </div>
  )
}

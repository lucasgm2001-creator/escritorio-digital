import { MessageCircle } from 'lucide-react'

// Comentários — ESTRUTURA VISUAL de conversa em thread (sem banco). Composer inerte (aparência), pronto
// para plugar quando existir persistência. Reutilizável no futuro perfil do Cliente.
export function LeadComments() {
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] text-bento-muted">Discuta este lead com o time — em thread, por contexto.</p>
      <div className="flex items-center gap-2 rounded-bento border border-bento-border bg-bento-panel/40 px-3 py-2.5 opacity-70">
        <MessageCircle className="w-4 h-4 text-bento-dim shrink-0" />
        <span className="text-[12px] text-bento-dim">Escrever um comentário…</span>
      </div>
    </div>
  )
}

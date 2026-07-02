import { FileText, Image as ImageIcon, FileSignature, FileCheck, Music, Files } from 'lucide-react'

// Anexos — ESTRUTURA VISUAL (sem banco, sem upload). Prepara as famílias de arquivo do lead.
// Componente sem props: reutilizável no futuro perfil do Cliente sem mudança.
const GROUPS: { icon: typeof FileText; label: string }[] = [
  { icon: FileSignature, label: 'Contratos' },
  { icon: FileCheck, label: 'Propostas' },
  { icon: FileText, label: 'PDFs' },
  { icon: ImageIcon, label: 'Imagens' },
  { icon: Music, label: 'Áudios' },
  { icon: Files, label: 'Arquivos' },
]

export function LeadAttachments() {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {GROUPS.map(group => {
          const Icon = group.icon
          return (
            <div key={group.label} className="flex items-center gap-2 rounded-btn border border-bento-border px-2.5 py-2">
              <Icon className="w-4 h-4 text-bento-dim shrink-0" />
              <span className="text-[12px] text-bento-muted truncate flex-1">{group.label}</span>
              <span className="font-tech text-[11px] text-bento-dim tabular-nums">0</span>
            </div>
          )
        })}
      </div>
      <div className="rounded-bento border border-dashed border-bento-border px-3 py-4 text-center">
        <Files className="w-5 h-5 text-bento-dim mx-auto" />
        <p className="text-[12px] text-bento-muted mt-1.5">Ainda sem arquivos neste lead</p>
      </div>
    </div>
  )
}

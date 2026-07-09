import {
  Brain,
  DollarSign,
  FileText,
  Handshake,
  Mail,
  MessageCircle,
  Phone,
  Pin,
  Star,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { LeadCategory } from './lead-hub-types'

// Taxonomia visual de categorias (LEAD-002). Cada categoria tem ícone SVG, rótulo e classes de cor próprias.
// Cores restritas à paleta já usada no projeto (bento/lime/blue/emerald/amber/red) — nada novo no build.
export const LEAD_CATEGORIES: Record<LeadCategory, { icon: LucideIcon; label: string; cls: string }> = {
  ligacao:    { icon: Phone, label: 'Ligação',    cls: 'text-blue-400 bg-blue-900/20 border-blue-800/40' },
  whatsapp:   { icon: MessageCircle, label: 'WhatsApp',   cls: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40' },
  email:      { icon: Mail, label: 'Email',      cls: 'text-blue-400 bg-blue-900/20 border-blue-800/40' },
  reuniao:    { icon: Handshake, label: 'Reunião',    cls: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/40' },
  negociacao: { icon: DollarSign, label: 'Negociação', cls: 'text-lime-fg bg-lime/10 border-lime/20' },
  problema:   { icon: TriangleAlert, label: 'Problema',   cls: 'text-red-400 bg-red-900/20 border-red-800/40' },
  informacao: { icon: Pin, label: 'Informação', cls: 'text-bento-dim bg-bento-panel/60 border-bento-border' },
  importante: { icon: Star, label: 'Importante', cls: 'text-amber-400 bg-amber-900/20 border-amber-800/40' },
  contrato:   { icon: FileText, label: 'Contrato',   cls: 'text-lime-fg bg-lime/10 border-lime/20' },
  estrategia: { icon: Brain, label: 'Estratégia', cls: 'text-amber-400 bg-amber-900/20 border-amber-800/40' },
}

// Deriva a categoria de EXIBIÇÃO a partir do `type` da interação existente (LeadDiary) — sem tocar o banco.
export function categoryForInteractionType(type: string): LeadCategory {
  switch (type) {
    case 'atendeu':
    case 'nao_atendeu':
    case 'ligacao':
    case 'call':
      return 'ligacao'
    case 'mensagem':
    case 'whatsapp':
      return 'whatsapp'
    case 'email':
      return 'email'
    case 'nota':
    case 'observacao':
      return 'informacao'
    default:
      return 'informacao'
  }
}

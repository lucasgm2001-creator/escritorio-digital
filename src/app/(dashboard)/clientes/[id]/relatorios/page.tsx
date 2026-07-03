import { FileText } from 'lucide-react'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Relatórios do Cliente — catálogo (roadmap elegante). Consumirá o Reporting Engine (mesma fonte do PDF).
const REPORTS = [
  { title: 'Relatório mensal', desc: 'Consolidado do mês do cliente.' },
  { title: 'Relatório executivo', desc: 'Visão de diretoria com KPIs e insights.' },
  { title: 'Comparação de períodos', desc: 'Mês atual vs. período anterior.' },
  { title: 'Histórico de PDFs', desc: 'Relatórios gerados anteriormente.' },
  { title: 'Exportações', desc: 'PDF e CSV sob demanda.' },
  { title: 'Briefing automático', desc: 'Resumo do período via AI Engine.' },
]

export default function ClientRelatoriosPage() {
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Relatórios"
        subtitle="Relatórios do cliente — reusam o Reporting Engine (mesma fonte do PDF Executivo)."
        size="compact"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {REPORTS.map(report => (
          <div key={report.title} className="bento-fx p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-lime-fg" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-bento-text">{report.title}</p>
              <p className="text-[12px] text-bento-muted mt-0.5 leading-relaxed">{report.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { FileText } from 'lucide-react'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'

const REPORTS = [
  { title: 'Relatório mensal', desc: 'Consolidado do mês por cliente e plataforma.' },
  { title: 'Relatório executivo', desc: 'Visão de diretoria com KPIs e insights.' },
  { title: 'Comparativos', desc: 'Período atual vs. período anterior.' },
  { title: 'Exportações', desc: 'PDF e CSV sob demanda, por período.' },
]

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Relatórios" subtitle="Relatórios de mídia — mesma fonte do PDF Executivo (Reporting Engine)." />

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

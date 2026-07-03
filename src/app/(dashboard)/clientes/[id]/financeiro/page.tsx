import { Panel } from '@/components/bento/Panel'
import { AdminStat } from '@/components/admin/AdminStat'

// Financeiro do Cliente — REUSA AdminStat + Panel. Estrutura visual (mensalidades/recebimentos/pendências/
// histórico/notas); sem dados/consulta nesta fase.
const STATUS = [
  { label: 'Mensalidade', value: '—' },
  { label: 'Recebido (mês)', value: '—' },
  { label: 'Pendências', value: '—' },
  { label: 'Próx. cobrança', value: '—' },
]

export default function ClientFinanceiroPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">Financeiro</h1>
        <p className="text-sm text-bento-muted">Mensalidades, recebimentos e pendências do cliente. Estrutura pronta — sem dados nesta fase.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {STATUS.map(item => <AdminStat key={item.label} label={item.label} value={item.value} hint="em breve" />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel label="Histórico de pagamentos">
          <p className="text-[13px] text-bento-muted leading-relaxed">O histórico de recebimentos aparece quando os pagamentos do cliente forem conectados.</p>
        </Panel>
        <Panel label="Notas financeiras">
          <p className="text-[13px] text-bento-muted leading-relaxed">Anotações de cobrança, acordos e pendências ficam aqui.</p>
        </Panel>
      </div>
    </div>
  )
}

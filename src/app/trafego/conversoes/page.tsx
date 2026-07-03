import { AdminStat } from '@/components/admin/AdminStat'
import { Panel } from '@/components/bento/Panel'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'

const EVENTS = ['Purchase', 'Lead', 'Complete Registration', 'Initiate Checkout', 'Add to Cart', 'View Content']

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Conversões" subtitle="Pixel e eventos de conversão — padrão e customizados." />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {EVENTS.map(event => <AdminStat key={event} label={event} value="—" />)}
      </div>

      <Panel label="Pixel & Conversions API">
        <p className="text-[13px] text-bento-muted leading-relaxed">
          Nenhum pixel conectado. Conecte o Meta Pixel e a Conversions API em Contas para medir conversões,
          eventos padrão e eventos customizados.
        </p>
      </Panel>
    </div>
  )
}

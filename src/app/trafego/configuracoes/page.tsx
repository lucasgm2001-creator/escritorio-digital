import { Panel } from '@/components/bento/Panel'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'

const SETTINGS = [
  { label: 'Conta padrão', value: '—' },
  { label: 'Moeda', value: 'USD' },
  { label: 'Fuso horário', value: '—' },
  { label: 'Janela de atribuição', value: '7 dias clique / 1 dia visualização' },
  { label: 'Sincronização', value: 'Manual' },
  { label: 'Notificações', value: '—' },
]

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Configurações" subtitle="Preferências do módulo — conta padrão, moeda, atribuição e sincronização." />

      <Panel label="Preferências">
        <div className="divide-y divide-bento-border/60">
          {SETTINGS.map(setting => (
            <div key={setting.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="text-[13px] text-bento-muted">{setting.label}</span>
              <span className="text-[13px] text-bento-text text-right">{setting.value}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

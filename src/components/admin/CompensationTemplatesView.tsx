import { Panel } from '@/components/bento/Panel'
import type { CompensationPreview, CompensationRule, CompensationRuleType, CompensationTemplateDefinition } from '@/core/compensation/types'

const RULE_LABEL: Record<CompensationRuleType, string> = {
  salary_fixed: 'Salário fixo',
  commission_percent: 'Comissão %',
  commission_fixed: 'Comissão fixa',
  upgrade_percent: 'Upgrade %',
  renewal_fixed: 'Renovação',
  bonus_fixed: 'Bônus',
}

const usd = (n: number): string => `US$ ${n.toLocaleString('en-US')}`

function ruleDesc(rule: CompensationRule): string {
  if (rule.type === 'commission_percent' || rule.type === 'upgrade_percent') {
    return `${Math.round((rule.rate ?? 0) * 100)}%${rule.weeksLimit ? ` · até ${rule.weeksLimit} sem` : ''}`
  }
  return rule.amount != null ? usd(rule.amount) : '—'
}

// Leitura REAL da Compensation Engine em Administração › Remuneração (só leitura; edição chega depois).
export function CompensationTemplatesView({ templates, preview }: { templates: CompensationTemplateDefinition[]; preview: CompensationPreview | null }) {
  const previewCards = preview
    ? [
        { label: 'Salário', value: preview.salary },
        { label: 'Comissão', value: preview.commission },
        { label: 'Upgrade', value: preview.upgrade },
        { label: 'Renovação', value: preview.renewal },
        { label: 'Bônus', value: preview.bonus },
        { label: 'Total', value: preview.total },
      ]
    : []
  const commissionLine = preview?.lines.find(line => line.type === 'commission_percent') ?? null

  return (
    <div className="space-y-6">
      {templates.length === 0 && <p className="text-sm text-bento-muted">Nenhum template.</p>}

      {templates.map(template => (
        <Panel key={template.id} label={`${template.name} · ${template.currency} · v${template.version}`}>
          <div className="space-y-1.5">
            {template.rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-bento-text">{RULE_LABEL[rule.type]}</span>
                <span className="font-tech text-xs text-bento-muted">{ruleDesc(rule)} · {rule.on}</span>
              </div>
            ))}
          </div>
        </Panel>
      ))}

      {preview && (
        <Panel label="Prévia — Closer, venda de plano US$140/semana">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {previewCards.map(card => (
              <div key={card.label} className="bento-fx p-3">
                <p className="font-display font-bold text-base text-bento-text leading-none truncate">{usd(card.value)}</p>
                <p className="text-[11px] text-bento-muted mt-1.5">{card.label}</p>
              </div>
            ))}
          </div>
          {commissionLine && (
            <p className="text-[12px] text-bento-muted mt-3">
              Comissão: {usd(commissionLine.perInstallment)}/semana × {commissionLine.installments} = {usd(commissionLine.total)}.
            </p>
          )}
          <p className="text-[11px] text-bento-dim mt-1">
            Calculado pela Compensation Engine (pura). Somente leitura — edição e ledger chegam nas próximas fases.
          </p>
        </Panel>
      )}
    </div>
  )
}

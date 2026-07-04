import { Panel } from '@/components/bento/Panel'
import type { CompensationRule, CompensationRuleType, CompensationTemplateDefinition } from '@/core/compensation/types'

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

// Modelo de remuneração por função (Compensation Engine, só leitura). Mostra as REGRAS de cada template.
// A remuneração REAL de vendedores (salário/comissão/pagamentos) fica na config acima (VendedoresTab).
export function CompensationTemplatesView({ templates }: { templates: CompensationTemplateDefinition[] }) {
  if (templates.length === 0) {
    return <p className="text-sm text-bento-muted">Nenhum template de remuneração cadastrado.</p>
  }

  return (
    <div className="space-y-6">
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
    </div>
  )
}

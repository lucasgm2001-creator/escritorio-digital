import type {
  CompensationEvent, CompensationLine, CompensationPreview, CompensationRule,
  CompensationRuleType, CompensationTemplateDefinition,
} from './types'

// COMPENSATION ENGINE — PURA (Constituição, Título 4). Interpreta as REGRAS declarativas do template
// contra um EVENTO e devolve um PREVIEW. Sem React, Supabase, UI ou efeitos colaterais. É o cérebro:
// toda comissão futura passa por aqui. Nada persiste; histórico nunca é recalculado.

const round = (n: number): number => Math.round(n * 100) / 100

type Category = 'salary' | 'commission' | 'bonus' | 'upgrade' | 'renewal'

const CATEGORY: Record<CompensationRuleType, Category> = {
  salary_fixed: 'salary',
  commission_percent: 'commission',
  commission_fixed: 'commission',
  upgrade_percent: 'upgrade',
  renewal_fixed: 'renewal',
  bonus_fixed: 'bonus',
}

// Interpretadores por TIPO (mapa declarativo — não um switch gigante espalhado). Cada um devolve o
// valor POR PARCELA e o número de parcelas; teto/acelerador são aplicados depois, de forma uniforme.
const INTERPRETERS: Record<CompensationRuleType, (rule: CompensationRule, event: CompensationEvent) => { label: string; perInstallment: number; installments: number }> = {
  salary_fixed: (rule) => ({ label: 'Salário fixo', perInstallment: rule.amount ?? 0, installments: 1 }),
  commission_percent: (rule, event) => ({
    label: 'Comissão',
    perInstallment: (event.weeklyValue ?? event.saleValue ?? 0) * (rule.rate ?? 0),
    installments: rule.weeksLimit ?? 1,
  }),
  commission_fixed: (rule) => ({ label: 'Comissão fixa', perInstallment: rule.amount ?? 0, installments: 1 }),
  upgrade_percent: (rule, event) => ({
    label: 'Upgrade',
    perInstallment: (event.upgradeDelta ?? 0) * (rule.rate ?? 0),
    installments: rule.weeksLimit ?? 1,
  }),
  renewal_fixed: (rule) => ({ label: 'Renovação', perInstallment: rule.amount ?? 0, installments: 1 }),
  bonus_fixed: (rule) => ({ label: 'Bônus', perInstallment: rule.amount ?? 0, installments: 1 }),
}

export function computePreview(template: CompensationTemplateDefinition, event: CompensationEvent): CompensationPreview {
  const lines: CompensationLine[] = []
  const totals: Record<Category, number> = { salary: 0, commission: 0, bonus: 0, upgrade: 0, renewal: 0 }

  for (const rule of template.rules) {
    // Salário fixo entra sempre (base). As demais regras só quando o gatilho casa com o evento.
    const applies = rule.type === 'salary_fixed' || rule.on === event.type
    if (!applies) continue

    const out = INTERPRETERS[rule.type](rule, event)
    let perInstallment = out.perInstallment
    if (rule.accelerator) perInstallment *= rule.accelerator            // campanha / acelerador
    const installments = Math.max(1, rule.installments ?? out.installments)
    let total = perInstallment * installments
    if (rule.cap != null) total = Math.min(total, rule.cap)             // teto

    totals[CATEGORY[rule.type]] += total
    lines.push({
      ruleId: rule.id, type: rule.type, label: out.label,
      amount: round(perInstallment * installments), installments,
      perInstallment: round(perInstallment), total: round(total), currency: template.currency,
    })
  }

  return {
    collaboratorId: event.collaboratorId, templateId: template.id, templateName: template.name,
    event: event.type, currency: template.currency,
    salary: round(totals.salary), commission: round(totals.commission), bonus: round(totals.bonus),
    upgrade: round(totals.upgrade), renewal: round(totals.renewal),
    total: round(totals.salary + totals.commission + totals.bonus + totals.upgrade + totals.renewal),
    lines,
  }
}

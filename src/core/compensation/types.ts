// Domínio da COMPENSATION ENGINE (COMPENSATION-004). Tipos PUROS (sem 'server-only'): o cérebro da
// remuneração. Regras são DADOS declarativos interpretados pela engine — nada de ifs espalhados.
// Nada aqui persiste, calcula histórico ou toca banco/UI.

export type CompensationCurrency = 'USD' | 'BRL'

export type CompensationEventType =
  | 'salary'
  | 'sale.created'
  | 'payment.received'
  | 'renewal.completed'
  | 'upgrade.completed'
  | 'meeting.completed'

export type CompensationRuleType =
  | 'salary_fixed'        // salário fixo (base, por período)
  | 'commission_percent'  // comissão % (sobre valor/semana), com parcelamento por semanas
  | 'commission_fixed'    // valor fixo por evento
  | 'upgrade_percent'     // % da diferença do upgrade
  | 'renewal_fixed'       // valor fixo na renovação
  | 'bonus_fixed'         // bônus fixo

// Regra declarativa. A engine usa só os parâmetros que se aplicam ao `type`.
export type CompensationRule = {
  id: string
  type: CompensationRuleType
  on: CompensationEventType    // gatilho
  amount?: number              // valor fixo (salary/commission_fixed/renewal/bonus)
  rate?: number                // 0..1 (commission_percent, upgrade_percent)
  weeksLimit?: number          // teto de semanas (parcelamento)
  installments?: number        // parcelas explícitas (sobrepõe weeksLimit se definido)
  cap?: number                 // teto de valor total
  accelerator?: number         // multiplicador (campanha/acelerador)
}

export type CompensationTemplateDefinition = {
  id: string
  teamId: string
  name: string
  roleId: string | null
  version: number              // versionado: mudar cria versão nova; histórico nunca recalcula
  currency: CompensationCurrency
  rules: CompensationRule[]
}

export type CompensationAssignment = {
  id: string
  teamId: string
  collaboratorId: string
  templateId: string
  effectiveFrom: string        // ISO — vigência
}

// Evento que aciona a engine (base do preview).
export type CompensationEvent = {
  type: CompensationEventType
  collaboratorId: string
  occurredAt: string
  saleValue?: number           // valor da venda (base)
  weeklyValue?: number         // valor por semana (parcelamento)
  upgradeDelta?: number        // diferença do upgrade
  meetingValue?: number
}

// ---- Preview (sem persistir) ----
export type CompensationLine = {
  ruleId: string
  type: CompensationRuleType
  label: string
  amount: number               // valor total antes do teto
  installments: number         // nº de parcelas (ex.: semanas)
  perInstallment: number       // valor por parcela
  total: number                // valor final (após teto/acelerador)
  currency: CompensationCurrency
}

export type CompensationPreview = {
  collaboratorId: string
  templateId: string
  templateName: string
  event: CompensationEventType
  currency: CompensationCurrency
  salary: number
  commission: number
  bonus: number
  upgrade: number
  renewal: number
  total: number
  lines: CompensationLine[]
}

// ---- Contratos de Ledger (PARTE 9) — só contratos, sem persistência/migration ----
export type LedgerSnapshot = {
  templateId: string
  templateVersion: number
  rules: CompensationRule[]     // regra CONGELADA — histórico imutável
  currency: CompensationCurrency
}

export type CompensationCalculation = {
  templateId: string
  templateVersion: number
  event: CompensationEvent
  snapshot: LedgerSnapshot
}

export type CompensationResult = {
  preview: CompensationPreview
  calculation: CompensationCalculation
}

export type LedgerEntryStatus = 'pending' | 'released' | 'paid' | 'void'
export type LedgerEntry = {
  id: string
  teamId: string
  collaboratorId: string
  eventType: CompensationEventType
  occurredAt: string
  amount: number
  installmentIndex: number | null
  snapshot: LedgerSnapshot
  status: LedgerEntryStatus
}

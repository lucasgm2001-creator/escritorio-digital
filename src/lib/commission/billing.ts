import { dowOfYmd, addDaysYmd, addMonthsYmd } from '@/lib/date'

// CADÊNCIA DE COBRANÇA (BILLING-CADENCE-001). O motor nasceu 100% semanal: toda a régua era
// "vencimento = n-ésima ocorrência do dia da semana". Agora a cobrança pode ser a cada X dias, semanas ou
// meses, e a semanal passa a ser apenas o CASO PADRÃO dessa régua geral — por isso `SEMANAL` é o default
// em toda função daqui: cliente sem cadência configurada se comporta exatamente como antes, byte a byte.

export type BillingUnit = 'dia' | 'semana' | 'mes'
export type BillingCadence = { every: number; unit: BillingUnit }

export const SEMANAL: BillingCadence = { every: 1, unit: 'semana' }

/** Normaliza o que vem do banco (colunas podem ser null em cliente antigo) para uma cadência válida. */
export function cadenceOf(row: { billing_every?: number | null; billing_unit?: string | null } | null | undefined): BillingCadence {
  const every = Number(row?.billing_every)
  const unit = row?.billing_unit
  if (!Number.isFinite(every) || every < 1) return SEMANAL
  if (unit !== 'dia' && unit !== 'semana' && unit !== 'mes') return SEMANAL
  return { every: Math.floor(every), unit }
}

/**
 * Vencimento da n-ésima cobrança (n começa em 1).
 *  • semana → mantém o alinhamento com o DIA DA SEMANA escolhido (é o que o cliente combinou: "toda
 *    sexta"), e o passo é 7 × every.
 *  • dia / mes → ancora na própria data de início. Alinhar com dia da semana aqui não faria sentido:
 *    "a cada 10 dias" ou "todo dia 5" não têm relação com o calendário semanal.
 */
export function dueDateForCadence(startYmd: string, diaPagamento: number, n: number, cadence: BillingCadence = SEMANAL): string {
  const passo = n - 1
  if (cadence.unit === 'semana') {
    const offset = (((diaPagamento - dowOfYmd(startYmd)) % 7) + 7) % 7
    return addDaysYmd(startYmd, offset + 7 * cadence.every * passo)
  }
  if (cadence.unit === 'dia') return addDaysYmd(startYmd, cadence.every * passo)
  return addMonthsYmd(startYmd, cadence.every * passo)
}

// Janela do "primeiro mês" para fins de COMISSÃO: 28 dias, não mês de calendário.
// Mês de calendário quebraria o contrato semanal que já roda: [20/09, 20/10) contém 5 vencimentos
// semanais, e a regra vigente (e o teto gravado em todas as vendas existentes) é 4. 28 dias = 4 semanas
// exatas, que é o que "20% do pagamento de cada semana por um mês" quer dizer.
const DIAS_PRIMEIRO_MES = 28

/**
 * Quantas cobranças caem no primeiro mês de contrato — a BASE DA COMISSÃO.
 * Regra do negócio: 20% de TODO dinheiro que entra no primeiro mês, em quantas parcelas forem.
 *   semanal   → 4 cobranças    quinzenal → 2    mensal → 1    a cada 10 dias → 3
 * O total ganho é sempre 20% do primeiro mês; muda só em quantas parcelas ele é pago.
 * Janela meio-aberta [início, início+28d): vencimento exatamente no 28º dia já é do segundo mês.
 */
export function chargesInFirstMonth(startYmd: string, diaPagamento: number, cadence: BillingCadence = SEMANAL): number {
  const fim = addDaysYmd(startYmd, DIAS_PRIMEIRO_MES)
  let n = 0
  for (let i = 1; i <= 31; i++) {
    if (dueDateForCadence(startYmd, diaPagamento, i, cadence) >= fim) break
    n = i
  }
  return Math.max(1, n)   // contrato cuja 1ª cobrança já passa da janela ainda gera uma parcela
}

/** Rótulo curto da cadência, para tela e histórico. */
export function cadenceLabel(c: BillingCadence): string {
  if (c.unit === 'semana' && c.every === 1) return 'Semanal'
  if (c.unit === 'mes' && c.every === 1) return 'Mensal'
  const plural = c.every > 1
  const nome = c.unit === 'dia' ? (plural ? 'dias' : 'dia') : c.unit === 'semana' ? (plural ? 'semanas' : 'semana') : (plural ? 'meses' : 'mês')
  return `A cada ${c.every} ${nome}`
}

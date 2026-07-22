// FONTE ÚNICA de data/timezone do sistema (SPRINT-FINAL-001). Consolidou as ~9 cópias de spToday/todaySP,
// dowOfYmd, addDaysYmd, ymd, pad2, dayBR e os limites de dia/semana/mês que viviam espalhados em services,
// rotas, o Hall e o period. Browser-safe (SEM 'server-only'): usado tanto no cliente (formatação) quanto no
// servidor (KPIs, cron, cobrança). Convenção: "YMD" = string civil 'YYYY-MM-DD'.
//
// Regra de ouro: campos DATE-ONLY ('YYYY-MM-DD') NUNCA passam por `new Date(string)` (viraria UTC meia-noite
// e "pula" um dia em BRT). Para eles, montamos Date LOCAL pelas partes, ou operamos a string em UTC civil.

const pad2 = (n: number): string => String(n).padStart(2, '0')

// ── Date → string (partes LOCAIS — mesma convenção do rangeFor/period) ──
/** Date → 'YYYY-MM-DD'. */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
/** Date → 'dd/MM'. */
export const ddmm = (d: Date): string => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`

// ── Fuso de Brasília (a régua civil do sistema: cobrança, agenda, KPIs do dia) ──
/** Dia civil (YYYY-MM-DD) de uma data no fuso America/Sao_Paulo. Antes copiado como dayBR/spToday. */
export const dayBR = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
/** Hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. Antes copiado como spToday() em 9 arquivos. */
export const todaySP = (): string => dayBR(new Date())

// ── Aritmética civil de YMD (UTC só p/ não pular dia; o resultado é a data civil) ──
/** Dia-da-semana (0=Dom..6=Sáb) de um YMD. */
export const dowOfYmd = (s: string): number => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
/** YMD + N dias (N pode ser negativo) → YMD. */
export const addDaysYmd = (s: string, days: number): string => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10)
}

// ── Limites de intervalo (Date) — base do rangeFor e de janelas de relatório. Semana começa na SEGUNDA. ──
export const startOfDay = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const endOfDay = (d: Date): Date => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
export const startOfWeek = (d: Date): Date => { const x = startOfDay(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return x }
export const endOfWeek = (d: Date): Date => { const s = startOfWeek(d); return endOfDay(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)) }
export const startOfMonth = (d: Date): Date => startOfDay(new Date(d.getFullYear(), d.getMonth(), 1))
export const endOfMonth = (d: Date): Date => endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0))

// Formatação de campos DATE-ONLY ('YYYY-MM-DD') em dd/MM/yyyy, no fuso LOCAL.
//
// Bug que resolve: `new Date('2026-06-29')` é interpretado como UTC meia-noite; renderizado em BRT (−3h)
// vira 28/06. Por isso, p/ strings 'YYYY-MM-DD' montamos um Date LOCAL (ano, mês−1, dia) — NUNCA
// `new Date(string)` direto. Para Date/ISO completo (timestamptz) usamos o próprio Date (já tem fuso).
//
// Use APENAS em campos date-only: start_date, end_date, data_fechamento, paid_on. Para timestamps
// (created_at etc.) continue com TimeAgo/formatDate.
export function formatDateBR(d: string | Date | null | undefined): string {
  if (d == null || d === '') return '—'
  let date: Date
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      // 'YYYY-MM-DD' (ou 'YYYY-MM-DDThh:mm') → Date LOCAL pela parte da data (sem deslocar de fuso).
      date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    } else {
      const parsed = new Date(d)
      if (isNaN(parsed.getTime())) return '—'
      date = parsed
    }
  } else {
    date = d
  }
  if (isNaN(date.getTime())) return '—'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}

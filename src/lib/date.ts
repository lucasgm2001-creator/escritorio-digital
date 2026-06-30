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

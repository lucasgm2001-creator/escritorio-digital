import { ddmm, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '@/lib/date'

// Seletor de período compartilhado (mesma lógica do Relatório de Atividades).
export type Mode = 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'ano' | 'tudo'
export interface Range { mode: string; start: Date; end: Date; label: string }

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// Limites de dia/semana/mês vêm da fonte única de datas (@/lib/date) — semana começa na SEGUNDA.

export function rangeFor(mode: Mode, now = new Date()): Range {
  if (mode === 'dia') return { mode, start: startOfDay(now), end: endOfDay(now), label: `Dia ${ddmm(now)}` }
  if (mode === 'semana') {
    const start = startOfWeek(now); const end = endOfWeek(now)
    return { mode, start, end, label: `Semana de ${ddmm(start)} a ${ddmm(end)}` }
  }
  if (mode === 'mes') {
    return { mode, start: startOfMonth(now), end: endOfMonth(now), label: `${MONTHS[now.getMonth()]} de ${now.getFullYear()}` }
  }
  if (mode === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3)
    const start = startOfDay(new Date(now.getFullYear(), q * 3, 1))
    const end = endOfDay(new Date(now.getFullYear(), q * 3 + 3, 0))
    return { mode, start, end, label: `${q + 1}º trimestre de ${now.getFullYear()}` }
  }
  if (mode === 'tudo') {
    return { mode, start: new Date(2000, 0, 1), end: endOfDay(now), label: 'Tudo' }
  }
  if (mode === 'semestre') {
    const h1 = now.getMonth() < 6
    const start = startOfDay(new Date(now.getFullYear(), h1 ? 0 : 6, 1))
    const end = endOfDay(new Date(now.getFullYear(), h1 ? 6 : 12, 0))
    return { mode, start, end, label: `${h1 ? '1º' : '2º'} semestre de ${now.getFullYear()}` }
  }
  const start = startOfDay(new Date(now.getFullYear(), 0, 1))
  const end = endOfDay(new Date(now.getFullYear(), 11, 31))
  return { mode, start, end, label: `Ano de ${now.getFullYear()}` }
}

// Filtro por ATIVIDADE: usa a data de última atividade (updated_at); na falta, created_at.
// 'tudo' nunca filtra (mostra tudo). Compartilhado pelo Funil e por Contatos — sem duplicar lógica.
export function inPeriodByActivity(range: Range, updated?: string | null, created?: string | null): boolean {
  if (range.mode === 'tudo') return true
  const iso = updated ?? created
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= range.start.getTime() && t <= range.end.getTime()
}

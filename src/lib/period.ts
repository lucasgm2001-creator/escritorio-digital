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

// ── Navegar no tempo mantendo o MODO (PERIODO-NAV-001) ──────────────────────────────────────────
// A seta anda uma unidade do próprio período: mês → mês anterior/seguinte, semana → 7 dias, trimestre → 3
// meses, e assim por diante. Reconstrói pelo rangeFor a partir da nova âncora, então limites e rótulo saem
// pela MESMA regra do preset — sem uma segunda régua de datas que pudesse divergir.
// 'tudo' e 'custom' não têm unidade para andar: devolvem o próprio range (a UI desabilita as setas).
export function canShift(mode: string): boolean {
  return mode === 'dia' || mode === 'semana' || mode === 'mes' || mode === 'trimestre' || mode === 'semestre' || mode === 'ano'
}

export function shiftRange(range: Range, delta: number): Range {
  if (!canShift(range.mode) || delta === 0) return range
  const a = range.start
  const mode = range.mode as Mode
  const anchor =
    mode === 'dia' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + delta)
      : mode === 'semana' ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + delta * 7)
        : mode === 'mes' ? new Date(a.getFullYear(), a.getMonth() + delta, 1)
          : mode === 'trimestre' ? new Date(a.getFullYear(), a.getMonth() + delta * 3, 1)
            : mode === 'semestre' ? new Date(a.getFullYear(), a.getMonth() + delta * 6, 1)
              : new Date(a.getFullYear() + delta, 0, 1)
  return rangeFor(mode, anchor)
}

/** O range é o período CORRENTE (mês atual, semana atual…)? Usado para desabilitar a seta "próximo". */
export function isCurrentPeriod(range: Range, now = new Date()): boolean {
  if (!canShift(range.mode)) return true
  return rangeFor(range.mode as Mode, now).start.getTime() === range.start.getTime()
}

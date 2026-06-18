// Horários da virada do tema 'auto' — configuráveis (client/localStorage), como o tema já é.
// Default: escuro das 18h às 6h (mesma regra de sempre). Lido também pelo script inline do layout.
export const DEFAULT_DARK_START = 18
export const DEFAULT_DARK_END = 6

export function getDarkHours(): { start: number; end: number } {
  try {
    const s = parseInt(localStorage.getItem('theme_dark_start') || '', 10)
    const e = parseInt(localStorage.getItem('theme_dark_end') || '', 10)
    return {
      start: Number.isInteger(s) && s >= 0 && s <= 23 ? s : DEFAULT_DARK_START,
      end:   Number.isInteger(e) && e >= 0 && e <= 23 ? e : DEFAULT_DARK_END,
    }
  } catch {
    return { start: DEFAULT_DARK_START, end: DEFAULT_DARK_END }
  }
}

// Escuro se a hora cai na janela [start, end) — suporta janela que cruza a meia-noite (18→6).
export function isDarkByTime(now: Date = new Date()): boolean {
  const { start, end } = getDarkHours()
  const h = now.getHours()
  return start <= end ? (h >= start && h < end) : (h >= start || h < end)
}

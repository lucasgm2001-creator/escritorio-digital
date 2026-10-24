// Configuração da "Visão Geral" do Hall — por usuário, em localStorage (sem migration). Lida no
// CLIENT (useEffect) p/ não dar hydration mismatch. O Hall lê isto p/ mostrar/esconder os blocos opcionais.
// Configurações > Andares > Hall escreve.

export interface HallSettings {
  // Blocos OPCIONAIS da Visão Geral. Agenda/Tarefas saíram (Follow-up); métricas nunca foram lidas pelo Hall.
  // (O Mapa é uma ABA própria do Hall, configurada em Configurações › Mapa.)
  blocks: { atividade: boolean; noticias: boolean }
}

export const DEFAULT_HALL_SETTINGS: HallSettings = {
  blocks: { atividade: true, noticias: true },
}

export const HALL_SETTINGS_EVENT = 'ed-hall-settings'
const keyFor = (userId: string) => `ed-hall-settings:${userId || 'anon'}`

export function getHallSettings(userId: string): HallSettings {
  if (typeof window === 'undefined') return DEFAULT_HALL_SETTINGS
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return DEFAULT_HALL_SETTINGS
    const p = JSON.parse(raw) as Partial<HallSettings>
    // Salvos antigos podem ter chaves que saíram (agenda/tarefas/metrics/map) — só as atuais são lidas.
    return {
      blocks: {
        atividade: p.blocks?.atividade ?? DEFAULT_HALL_SETTINGS.blocks.atividade,
        noticias: p.blocks?.noticias ?? DEFAULT_HALL_SETTINGS.blocks.noticias,
      },
    }
  } catch { return DEFAULT_HALL_SETTINGS }
}

export function setHallSettings(userId: string, s: HallSettings) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(s))
    window.dispatchEvent(new Event(HALL_SETTINGS_EVENT))
  } catch { /* ignore */ }
}

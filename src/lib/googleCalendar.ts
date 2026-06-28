import 'server-only'
import { google, calendar_v3 } from 'googleapis'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserCalendar } from '@/lib/google/oauth'

// Sincroniza tarefas (tabela `tasks`) com o Google Agenda. DUAL-PATH por tarefa, escolhido pelo DONO:
//  • dono conectou a conta Google (OAuth) → cria o evento COMO ele, no 'primary', e liga o Google Meet real.
//  • dono NÃO conectou → cai na CONTA DE SERVIÇO (JWT) EXATAMENTE como antes — sem Meet, sem regressão.
// SOMENTE servidor. Tudo BEST-EFFORT: o salvamento da tarefa NUNCA depende disto. NÃO toca em dinheiro/comissão.

const SA_SCOPES = ['https://www.googleapis.com/auth/calendar.events']
const TIMEZONE = 'America/Sao_Paulo'
const DURATION_MIN = 30

// Cliente do Calendar + calendarId + se PODE criar Meet (só o caminho OAuth pode).
type CalCtx = { calendar: calendar_v3.Calendar; calendarId: string; meet: boolean }

interface TaskRow {
  id: string
  user_id?: string | null
  title: string
  notes?: string | null
  due_date?: string | null
  due_time?: string | null
  linked_name?: string | null
  google_event_id?: string | null
  add_call?: boolean | null
  duration_min?: number | null   // reunião: duração do evento (min). Default 30 quando ausente.
  timezone?: string | null       // reunião: fuso IANA do start/end. Default America/Sao_Paulo.
}

// SÓ PRA LOG: extrai mensagem + código do erro (googleapis põe err.code / err.response.status).
function errMsg(e: unknown): string {
  const err = e as { message?: string; code?: unknown; response?: { status?: unknown } }
  const code = err?.code ?? err?.response?.status
  const msg = err?.message ?? String(e)
  return code !== undefined && code !== null ? `${msg} [code ${code}]` : msg
}

// CONTA DE SERVIÇO (GOOGLE_SERVICE_ACCOUNT_KEY = JSON completo). private_key tem \n — JSON.parse resolve.
// null se faltar env/credencial. Caminho IDÊNTICO ao de sempre (sem Meet) → fallback de quem não conectou.
function getServiceAccountClient(): { calendar: calendar_v3.Calendar; calendarId: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!raw || !calendarId) return null
  let creds: { client_email?: string; private_key?: string }
  try {
    creds = JSON.parse(raw)
  } catch (e) {
    console.error('[gcal] JSON parse FAIL:', (e as Error)?.message ?? e)
    return null
  }
  if (!creds.client_email || !creds.private_key) {
    console.error('[gcal] ERROR auth: credencial sem client_email/private_key.')
    return null
  }
  const auth = new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes: SA_SCOPES })
  return { calendar: google.calendar({ version: 'v3', auth }), calendarId }
}

// Escolhe o caminho: OAuth do dono (com Meet) se conectado; senão conta de serviço (sem Meet). null se nenhum.
async function resolveCtx(userId: string | null | undefined): Promise<CalCtx | null> {
  if (userId) {
    const oauth = await getUserCalendar(userId)
    if (oauth) return { ...oauth, meet: true }
  }
  const sa = getServiceAccountClient()
  if (sa) return { ...sa, meet: false }
  return null
}

// 'YYYY-MM-DD' + dias → 'YYYY-MM-DD' (UTC puro, sem escorregar por fuso).
function addDays(date: string, days: number): string {
  const dt = new Date(`${date}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// 'HH:MM' + minutos → { date, time }; rola pro dia seguinte se passar da meia-noite.
function addMinutes(date: string, time: string, mins: number): { date: string; time: string } {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  let total = h * 60 + m + mins
  let extraDays = 0
  while (total >= 1440) { total -= 1440; extraDays += 1 }
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return { date: extraDays ? addDays(date, extraDays) : date, time: `${hh}:${mm}` }
}

// conferenceData pra criar um Google Meet REAL no evento. requestId é idempotente do lado do Google
// (mesmo id ⇒ pedido repetido é ignorado). type 'hangoutsMeet' → link meet.google.com/... no evento.
function meetConference(requestId: string): calendar_v3.Schema$ConferenceData {
  return { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
}

// Tarefa → corpo do evento (summary/description/start/end). due_date vazio → null (não vira evento).
// callLink: se add_call e o usuário tem profiles.call_link, acrescenta UMA linha na descrição (link fixo
// pessoal). O Google Meet por-evento é anexado em createEvent/updateEvent (só no caminho OAuth).
function buildEventBody(task: TaskRow, callLink?: string | null): calendar_v3.Schema$Event | null {
  if (!task.due_date) return null
  const desc: string[] = []
  if (task.notes?.trim()) desc.push(task.notes.trim())
  if (task.linked_name?.trim()) desc.push(`Lead: ${task.linked_name.trim()}`)
  let description = desc.join('\n\n')
  if (callLink?.trim()) description = (description ? `${description}\n` : '') + `Link da videochamada: ${callLink.trim()}`
  const base = { summary: task.title?.trim() || 'Tarefa', description: description || undefined }

  if (task.due_time) {
    const t = task.due_time.slice(0, 5)
    const tz = task.timezone?.trim() || TIMEZONE                 // fuso da reunião (default Brasília)
    const dur = task.duration_min && task.duration_min > 0 ? task.duration_min : DURATION_MIN   // duração (default 30)
    const end = addMinutes(task.due_date, t, dur)
    return {
      ...base,
      start: { dateTime: `${task.due_date}T${t}:00`, timeZone: tz },
      end:   { dateTime: `${end.date}T${end.time}:00`, timeZone: tz },
    }
  }
  // Dia inteiro: end.date é EXCLUSIVO (dia seguinte).
  return { ...base, start: { date: task.due_date }, end: { date: addDays(task.due_date, 1) } }
}

// Anexa (ou remove, com null) o Google Meet num evento JÁ existente — SEMPRE best-effort: patch ISOLADO só
// do conferenceData + conferenceDataVersion:1, e QUALQUER erro é ENGOLIDO. Só é chamado no caminho OAuth.
async function tryConference(ctx: CalCtx, eventId: string, conferenceData: calendar_v3.Schema$ConferenceData | null): Promise<void> {
  try {
    await ctx.calendar.events.patch({
      calendarId: ctx.calendarId,
      eventId,
      requestBody: { conferenceData } as unknown as calendar_v3.Schema$Event,
      conferenceDataVersion: 1,
    })
    console.log('[gcal] meet OK · event', eventId, conferenceData ? '(+meet)' : '(meet removido)')
  } catch (e) {
    console.warn('[gcal] meet best-effort FALHOU (evento MANTIDO) · event', eventId, ':', errMsg(e))
  }
}

async function createEvent(ctx: CalCtx, task: TaskRow, callLink?: string | null): Promise<string | null> {
  const requestBody = buildEventBody(task, callLink); if (!requestBody) return null
  // 1) O EVENTO é criado SEMPRE, SEM conferenceData — uma falha de Meet jamais derruba o evento.
  let eventId: string | null
  try {
    const res = await ctx.calendar.events.insert({ calendarId: ctx.calendarId, requestBody })
    eventId = res.data.id ?? null
    console.log('[gcal] event OK id:', eventId)
  } catch (e) {
    console.error('[gcal] ERROR create:', errMsg(e))
    throw e
  }
  // 2) Meet REAL — SÓ no caminho OAuth (a conta de serviço não pode criar Meet). Best-effort.
  if (ctx.meet && eventId && task.add_call) await tryConference(ctx, eventId, meetConference(randomUUID()))
  return eventId
}

async function updateEvent(ctx: CalCtx, googleEventId: string, task: TaskRow, callLink?: string | null): Promise<void> {
  const requestBody = buildEventBody(task, callLink); if (!requestBody) return

  // 1) O EVENTO (título, notas, start/end, fuso, duração) é atualizado SEMPRE, SEM conferenceData.
  try {
    // PATCH (não update/PUT): atualiza só os campos enviados e PRESERVA o resto do evento —
    // convidados, lembretes, cor e recorrência ajustados manualmente no Google Agenda não são apagados.
    await ctx.calendar.events.patch({ calendarId: ctx.calendarId, eventId: googleEventId, requestBody })
    console.log('[gcal] event OK id:', googleEventId, '(patched)')
  } catch (e) {
    console.error('[gcal] ERROR update:', errMsg(e))
    throw e
  }

  // 2) Meet — SÓ no caminho OAuth. Reconcilia SEM duplicar (best-effort, nunca propaga):
  //  • quer chamada e ainda não tem → cria;  já tem → preserva;  não quer e tem → remove.
  //  • se o get falhar e quer chamada → requestId ESTÁVEL por evento (idempotente: cria 1x, não duplica).
  if (!ctx.meet) return
  try {
    const { data: ev } = await ctx.calendar.events.get({
      calendarId: ctx.calendarId, eventId: googleEventId, fields: 'hangoutLink,conferenceData',
    })
    const hasMeet = !!(ev.hangoutLink || ev.conferenceData?.conferenceId || (ev.conferenceData?.entryPoints?.length ?? 0) > 0)
    if (task.add_call && !hasMeet) await tryConference(ctx, googleEventId, meetConference(randomUUID()))
    else if (!task.add_call && hasMeet) await tryConference(ctx, googleEventId, null)
  } catch (e) {
    console.warn('[gcal] get p/ checar Meet falhou (segue best-effort):', errMsg(e))
    if (task.add_call) await tryConference(ctx, googleEventId, meetConference(`meet-${googleEventId}`))
  }
}

async function deleteEvent(ctx: CalCtx, googleEventId: string): Promise<void> {
  try {
    await ctx.calendar.events.delete({ calendarId: ctx.calendarId, eventId: googleEventId })
    console.log('[gcal] event OK id:', googleEventId, '(deleted)')
  } catch (e) {
    console.error('[gcal] ERROR delete:', errMsg(e))
    throw e
  }
}

// Resultado do sync. O client usa pra AVISAR (toast discreto) quando o Google falhar — sem reverter
// a tarefa (que já foi salva/excluída no banco). `ok:true` cobre tanto "sincronizou" quanto "no-op"
// (integração desligada / sem due_date), pois nenhum dos dois é falha a mostrar pro usuário.
export type CalSyncResult = { ok: true } | { ok: false; step: 'read' | 'create' | 'update' | 'delete' | 'write' | 'sync'; reason: string }

// ── Orquestração (best-effort, mas com resultado VISÍVEL) ───────────────────────
// Lê a linha FRESCA da tarefa, escolhe o caminho (OAuth do dono > conta de serviço) e reconcilia o evento:
//  • nenhum caminho disponível → no-op silencioso.
//  • sem due_date  → se tinha evento, apaga; só zera google_event_id DEPOIS do delete confirmado.
//  • com due_date  → tem evento? atualiza (patch). não tem? cria e grava o id (com ROLLBACK se o write falhar).
export async function syncTaskCalendar(taskId: string): Promise<CalSyncResult> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('tasks')
      .select('id, user_id, title, notes, due_date, due_time, linked_name, google_event_id, add_call, duration_min, timezone')
      .eq('id', taskId)
      .single()
    if (error || !data) return { ok: false, step: 'read', reason: error?.message ?? 'tarefa não encontrada' }
    const task = data as TaskRow
    console.log('[gcal] task', taskId, 'due_date:', task.due_date, 'due_time:', task.due_time, 'existing event:', task.google_event_id, 'add_call:', task.add_call)

    // OAuth do dono (com Meet) > conta de serviço (sem Meet). Nenhum → no-op (não é falha pro usuário).
    const ctx = await resolveCtx(task.user_id)
    if (!ctx) return { ok: true }
    console.log('[gcal] path:', ctx.meet ? 'oauth(+meet)' : 'service-account')

    // Link de chamada FIXO do dono (profiles.call_link) — só quando a tarefa marcou "Adicionar chamada".
    let callLink: string | null = null
    if (task.add_call && task.user_id) {
      const { data: prof } = await supabase.from('profiles').select('call_link').eq('id', task.user_id).single()
      callLink = (prof?.call_link as string | null) ?? null
    }

    // (A) SEM due_date: remove o evento (se houver). Só zera o id DEPOIS do delete confirmado — se o delete
    //     falhar, MANTÉM o id (trilha pra limpar depois) e sinaliza, em vez de perder a referência.
    if (!task.due_date) {
      if (!task.google_event_id) return { ok: true }
      try {
        await deleteEvent(ctx, task.google_event_id)
      } catch (e) {
        console.error('[gcal] delete FALHOU — MANTENDO google_event_id (trilha) · task', taskId, '· event', task.google_event_id, ':', errMsg(e))
        return { ok: false, step: 'delete', reason: errMsg(e) }
      }
      await supabase.from('tasks').update({ google_event_id: null }).eq('id', taskId)
      return { ok: true }
    }

    // (B) COM due_date + evento existente: atualiza (patch preserva ajustes manuais no Google).
    if (task.google_event_id) {
      try {
        await updateEvent(ctx, task.google_event_id, task, callLink)
      } catch (e) {
        console.error('[gcal] update FALHOU · task', taskId, '· event', task.google_event_id, ':', errMsg(e))
        return { ok: false, step: 'update', reason: errMsg(e) }
      }
      return { ok: true }
    }

    // (C) COM due_date + sem evento: cria e grava o id.
    let eventId: string | null
    try {
      eventId = await createEvent(ctx, task, callLink)
    } catch (e) {
      console.error('[gcal] create FALHOU · task', taskId, ':', errMsg(e))
      return { ok: false, step: 'create', reason: errMsg(e) }
    }
    if (!eventId) return { ok: true }   // sem corpo (sem due_date) → no-op (não é erro)
    const { error: upErr } = await supabase.from('tasks').update({ google_event_id: eventId }).eq('id', taskId)
    if (upErr) {
      // ROLLBACK: o evento foi CRIADO no Google mas o id NÃO gravou → apaga o evento, senão sobra um evento
      // sem id e o PRÓXIMO sync cria um SEGUNDO (duplicata). Se o rollback também falhar, loga o órfão.
      console.error('[gcal] gravar google_event_id FALHOU — rollback do evento', eventId, '· task', taskId, ':', upErr.message)
      try {
        await deleteEvent(ctx, eventId)
      } catch (delErr) {
        console.error('[gcal] ROLLBACK delete FALHOU — EVENTO ÓRFÃO', eventId, '· task', taskId, ':', errMsg(delErr))
      }
      return { ok: false, step: 'write', reason: `falha ao gravar id do evento: ${upErr.message}` }
    }
    return { ok: true }
  } catch (e) {
    console.error('[gcal] ERROR sync · task', taskId, ':', errMsg(e))
    return { ok: false, step: 'sync', reason: errMsg(e) }
  }
}

// Apaga o evento de uma tarefa que está sendo excluída (a linha some logo em seguida). Mesmo dual-path:
// OAuth do dono se conectado, senão conta de serviço. Não conectado/sem service account → no-op silencioso.
export async function deleteTaskEvent(userId: string | null | undefined, googleEventId: string): Promise<CalSyncResult> {
  const ctx = await resolveCtx(userId)
  if (!ctx) return { ok: true }
  try {
    await deleteEvent(ctx, googleEventId)
    return { ok: true }
  } catch (e) {
    console.error('[gcal] delete (exclusão de tarefa) FALHOU · event', googleEventId, ':', errMsg(e))
    return { ok: false, step: 'delete', reason: errMsg(e) }
  }
}

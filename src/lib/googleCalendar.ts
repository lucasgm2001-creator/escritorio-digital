import 'server-only'
import { google, calendar_v3 } from 'googleapis'
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

// 404/410 do Google = o evento não existe NESTE calendário (ex.: criado por outro caminho do dual-path).
function isNotFound(e: unknown): boolean {
  const err = e as { code?: unknown; response?: { status?: unknown } }
  const code = err?.code ?? err?.response?.status
  return code === 404 || code === '404' || code === 410 || code === '410'
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

// Descrição do evento: notas do usuário + (opcional) "Lead: X" + (opcional) a URL PURA do Meet, em bloco
// próprio e SEM rótulo/frase nenhuma. O Meet só existe depois do tryConference (createRequest é assíncrono),
// então a URL é anexada via patch best-effort em createEvent/updateEvent — aqui ela só entra quando já conhecida.
function buildDescription(task: TaskRow, meetUrl?: string | null): string | undefined {
  const parts: string[] = []
  if (task.notes?.trim()) parts.push(task.notes.trim())
  if (task.linked_name?.trim()) parts.push(`Lead: ${task.linked_name.trim()}`)
  if (meetUrl?.trim()) parts.push(meetUrl.trim())   // URL PURA, em linha própria, sem rótulo
  return parts.join('\n\n') || undefined
}

// Tarefa → corpo do evento (summary/description/start/end). due_date vazio → null (não vira evento).
function buildEventBody(task: TaskRow): calendar_v3.Schema$Event | null {
  if (!task.due_date) return null
  const base = { summary: task.title?.trim() || 'Tarefa', description: buildDescription(task) }

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

// URL do Google Meet a partir do recurso do evento: hangoutLink, senão o entryPoint de vídeo.
function meetUrlOf(ev: calendar_v3.Schema$Event | null | undefined): string | null {
  if (!ev) return null
  if (ev.hangoutLink) return ev.hangoutLink
  return ev.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null
}

// Anexa (ou remove, com null) o Google Meet num evento JÁ existente — SEMPRE best-effort: patch ISOLADO só
// do conferenceData + conferenceDataVersion:1, e QUALQUER erro é ENGOLIDO. Só é chamado no caminho OAuth.
// Retorna a URL do Meet (p/ salvar em tasks.meet_link) quando há conferência; null se removeu/não veio.
async function tryConference(ctx: CalCtx, eventId: string, conferenceData: calendar_v3.Schema$ConferenceData | null): Promise<string | null> {
  try {
    const res = await ctx.calendar.events.patch({
      calendarId: ctx.calendarId,
      eventId,
      requestBody: { conferenceData } as unknown as calendar_v3.Schema$Event,
      conferenceDataVersion: 1,
    })
    if (!conferenceData) { console.log('[gcal] meet removido · event', eventId); return null }
    // createRequest é ASSÍNCRONO → o link costuma não vir já no patch. Lê do patch; senão events.get best-effort.
    let url = meetUrlOf(res.data)
    if (!url) {
      try {
        const got = await ctx.calendar.events.get({ calendarId: ctx.calendarId, eventId, fields: 'hangoutLink,conferenceData' })
        url = meetUrlOf(got.data)
      } catch (e) { console.warn('[gcal] get p/ ler meet_link falhou (segue):', errMsg(e)) }
    }
    console.log('[gcal] meet OK · event', eventId, url ? '(+meet url)' : '(meet pendente, sem url ainda)')
    return url
  } catch (e) {
    console.warn('[gcal] meet best-effort FALHOU (evento MANTIDO) · event', eventId, ':', errMsg(e))
    return null
  }
}

// Best-effort: põe a URL PURA do Meet na descrição (notas + URL, sem rótulo). Chamado no MESMO ponto em que
// a URL é capturada; falha NUNCA derruba nada (só loga). Só no caminho OAuth (Meet real).
async function patchDescriptionWithMeet(ctx: CalCtx, eventId: string, task: TaskRow, meetUrl: string): Promise<void> {
  try {
    await ctx.calendar.events.patch({
      calendarId: ctx.calendarId,
      eventId,
      requestBody: { description: buildDescription(task, meetUrl) ?? meetUrl },
    })
    console.log('[gcal] descrição + meet url (pura) · event', eventId)
  } catch (e) {
    console.warn('[gcal] patch da descrição (meet url) falhou (segue):', errMsg(e))
  }
}

async function createEvent(ctx: CalCtx, task: TaskRow): Promise<{ eventId: string | null; meetLink: string | null }> {
  const requestBody = buildEventBody(task); if (!requestBody) return { eventId: null, meetLink: null }
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
  // 2) Meet REAL — SÓ no caminho OAuth. Best-effort; devolve a URL e a põe (pura) na descrição.
  let meetLink: string | null = null
  if (ctx.meet && eventId && task.add_call) {
    // B1: requestId determinístico por evento (mesmo da re-tentativa) → re-pedido devolve o MESMO Meet, não duplica.
    meetLink = await tryConference(ctx, eventId, meetConference(`meet-${eventId}`))
    if (meetLink) await patchDescriptionWithMeet(ctx, eventId, task, meetLink)
  }
  return { eventId, meetLink }
}

// Retorna: a URL do Meet (string) / null (sem Meet ou removido) / undefined (não mexer no meet_link — caminho
// service account, que não gerencia conferência).
async function updateEvent(ctx: CalCtx, googleEventId: string, task: TaskRow): Promise<string | null | undefined> {
  const requestBody = buildEventBody(task); if (!requestBody) return undefined

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

  // 2) Meet — SÓ no caminho OAuth. Reconcilia SEM duplicar (best-effort, nunca propaga) e devolve a URL:
  //  • quer chamada e ainda não tem → cria;  já tem → preserva (lê a url);  não quer e tem → remove (null).
  //  • se o get falhar e quer chamada → requestId ESTÁVEL por evento (idempotente: cria 1x, não duplica).
  if (!ctx.meet) return undefined   // service account: não gerencia Meet → não mexe no meet_link
  try {
    const { data: ev } = await ctx.calendar.events.get({
      calendarId: ctx.calendarId, eventId: googleEventId, fields: 'hangoutLink,conferenceData',
    })
    const hasMeet = !!(ev.hangoutLink || ev.conferenceData?.conferenceId || (ev.conferenceData?.entryPoints?.length ?? 0) > 0)
    if (task.add_call && !hasMeet) {                       // cria o Meet (requestId determinístico) e põe a URL na descrição
      const url = await tryConference(ctx, googleEventId, meetConference(`meet-${googleEventId}`))
      if (url) await patchDescriptionWithMeet(ctx, googleEventId, task, url)
      return url
    }
    if (task.add_call && hasMeet) {                        // já tem Meet → lê a url e a RE-ANEXA (o patch principal a removeu)
      const url = meetUrlOf(ev)
      if (url) { await patchDescriptionWithMeet(ctx, googleEventId, task, url); return url }
      return undefined   // B2: tem Meet mas a releitura não trouxe url → PRESERVA o meet_link atual (não zera)
    }
    if (!task.add_call && hasMeet) { await tryConference(ctx, googleEventId, null); return null }   // remove → descrição já sem URL
    return null                                                                            // !add_call && sem Meet
  } catch (e) {
    console.warn('[gcal] get p/ checar Meet falhou (segue best-effort):', errMsg(e))
    if (task.add_call) {
      const url = await tryConference(ctx, googleEventId, meetConference(`meet-${googleEventId}`))
      if (url) await patchDescriptionWithMeet(ctx, googleEventId, task, url)
      return url
    }
    return null
  }
}

async function deleteEvent(ctx: CalCtx, googleEventId: string): Promise<void> {
  try {
    await ctx.calendar.events.delete({ calendarId: ctx.calendarId, eventId: googleEventId })
    console.log('[gcal] event OK id:', googleEventId, '(deleted)')
  } catch (e) {
    // M5: 404/410 = evento não existe no calendário atual (trocou de caminho) → trata como já-apagado, não falha.
    if (isNotFound(e)) { console.warn('[gcal] delete 404/410 (evento já não existe aqui) · event', googleEventId); return }
    console.error('[gcal] ERROR delete:', errMsg(e))
    throw e
  }
}

// Resultado do sync. O client usa pra AVISAR (toast discreto) quando o Google falhar — sem reverter
// a tarefa (que já foi salva/excluída no banco). `ok:true` cobre tanto "sincronizou" quanto "no-op"
// (integração desligada / sem due_date), pois nenhum dos dois é falha a mostrar pro usuário.
export type CalSyncResult = { ok: true } | { ok: false; step: 'read' | 'create' | 'update' | 'delete' | 'write' | 'sync'; reason: string }

// Grava tasks.meet_link best-effort: falha NÃO trava o salvar da tarefa nem reverte nada (só loga). Fica
// SEPARADO do write de google_event_id (que tem rollback) — meet_link nunca dispara rollback.
async function setMeetLink(supabase: ReturnType<typeof createServiceClient>, taskId: string, link: string | null): Promise<void> {
  try {
    const { error } = await supabase.from('tasks').update({ meet_link: link }).eq('id', taskId)
    if (error) console.warn('[gcal] gravar meet_link falhou (segue):', error.message)
  } catch (e) {
    console.warn('[gcal] gravar meet_link exceção (segue):', errMsg(e))
  }
}

// Cria o evento no caminho atual e grava o id de volta com WRITE CONDICIONAL (.is('google_event_id', null)):
//  • erro de DB → ROLLBACK: apaga o evento criado.
//  • 0 linhas afetadas = outro sync concorrente JÁ gravou um id (corrida) → o evento novo é DUPLICADO → apaga
//    e fica com o id que venceu. Fecha a janela de duplicação (M4) sem lock.
// setMeetLink só roda quando o id realmente venceu. Best-effort em tudo.
async function createAndPersist(
  ctx: CalCtx,
  supabase: ReturnType<typeof createServiceClient>,
  task: TaskRow,
  taskId: string,
): Promise<CalSyncResult> {
  let created: { eventId: string | null; meetLink: string | null }
  try {
    created = await createEvent(ctx, task)
  } catch (e) {
    console.error('[gcal] create FALHOU · task', taskId, ':', errMsg(e))
    return { ok: false, step: 'create', reason: errMsg(e) }
  }
  const eventId = created.eventId
  if (!eventId) return { ok: true }   // sem corpo (sem due_date) → no-op (não é erro)
  const { data: rows, error: upErr } = await supabase
    .from('tasks').update({ google_event_id: eventId })
    .eq('id', taskId).is('google_event_id', null).select('id')
  if (upErr) {
    console.error('[gcal] gravar google_event_id FALHOU — rollback do evento', eventId, '· task', taskId, ':', upErr.message)
    try { await deleteEvent(ctx, eventId) } catch (delErr) { console.error('[gcal] ROLLBACK delete FALHOU — ÓRFÃO', eventId, '·', errMsg(delErr)) }
    return { ok: false, step: 'write', reason: `falha ao gravar id do evento: ${upErr.message}` }
  }
  if (!rows || rows.length === 0) {
    console.warn('[gcal] corrida: google_event_id já estava gravado — apagando evento DUPLICADO', eventId, '· task', taskId)
    try { await deleteEvent(ctx, eventId) } catch (delErr) { console.error('[gcal] apagar duplicado FALHOU — ÓRFÃO', eventId, '·', errMsg(delErr)) }
    return { ok: true }
  }
  await setMeetLink(supabase, taskId, created.meetLink)
  return { ok: true }
}

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
      await setMeetLink(supabase, taskId, null)   // sem evento → sem Meet
      return { ok: true }
    }

    // (B) COM due_date + evento existente: atualiza (patch). Se o evento sumiu do calendário atual (404 —
    //     trocou de caminho OAuth↔service account), limpa o id/meet_link stale e RE-CRIA no caminho atual (M5).
    if (task.google_event_id) {
      try {
        const meetLink = await updateEvent(ctx, task.google_event_id, task)
        if (meetLink !== undefined) await setMeetLink(supabase, taskId, meetLink)   // undefined = não mexer (service account / B2)
        return { ok: true }
      } catch (e) {
        if (isNotFound(e)) {
          console.warn('[gcal] update 404 — evento em outro calendário; limpando id/meet_link stale e recriando · task', taskId, '· stale', task.google_event_id)
          await supabase.from('tasks').update({ google_event_id: null }).eq('id', taskId)
          await setMeetLink(supabase, taskId, null)
          return await createAndPersist(ctx, supabase, task, taskId)   // re-sincroniza no caminho atual
        }
        console.error('[gcal] update FALHOU · task', taskId, '· event', task.google_event_id, ':', errMsg(e))
        return { ok: false, step: 'update', reason: errMsg(e) }
      }
    }

    // (C) COM due_date + sem evento: cria e grava o id (write condicional + rollback/dedup → M4).
    return await createAndPersist(ctx, supabase, task, taskId)
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

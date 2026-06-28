import 'server-only'
import { google, type calendar_v3 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'

// OAuth do USUÁRIO (não conta de serviço): cada um conecta a própria conta Google p/ o sync da Agenda criar
// Google Meet de verdade (conta de serviço não pode). Os tokens ficam em public.google_oauth_tokens, que tem
// RLS LIGADO e SEM policies → SÓ o service role acessa. client_secret e tokens NUNCA vão pro browser.

// calendar.events = criar/editar eventos (+ Meet, rodando como o usuário). openid/email = só p/ saber/exibir
// qual conta Google conectou (são escopos não-sensíveis, não precisam de config extra no consent screen).
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
]

// Redirect FIXA registrada no Google Console (override opcional via env). Tem que bater EXATAMENTE.
export const GOOGLE_OAUTH_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
  'https://escritorio-digital-v2.vercel.app/api/google/oauth/callback'

// Client OAuth2 (server-only). null se faltar env → feature desligada (sync vira no-op silencioso).
// Tipo de retorno INFERIDO de propósito: anotar com Auth.OAuth2Client conflita com a cópia aninhada de
// google-auth-library (googleapis-common) que o construtor devolve.
export function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return new google.auth.OAuth2({ clientId, clientSecret, redirectUri: GOOGLE_OAUTH_REDIRECT_URI })
}

// Email da conta Google a partir do id_token (vem com escopo openid/email). Sem verificar assinatura — o
// token veio direto do endpoint do Google sobre TLS; é só p/ exibir/registrar qual conta conectou.
export function emailFromIdToken(idToken?: string | null): string | null {
  if (!idToken) return null
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'))
    return typeof payload?.email === 'string' ? payload.email : null
  } catch { return null }
}

interface TokenRow {
  user_id: string
  google_email: string | null
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null   // timestamptz ISO
  scope: string | null
}

// Lê a linha de token do usuário (SERVICE ROLE — a tabela tem RLS sem policies).
export async function getTokenRow(userId: string): Promise<TokenRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('user_id, google_email, access_token, refresh_token, expires_at, scope')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) { console.error('[google-oauth] getTokenRow:', error.message); return null }
  return (data as TokenRow) ?? null
}

// Salva tokens no callback (upsert por user_id). PRESERVA o refresh_token e o email existentes quando o
// Google não manda novos — o refresh_token só vem no 1º consentimento/prompt=consent; NUNCA sobrescreve
// com null (omitir a coluna do payload faz o upsert NÃO mexer nela).
export async function saveTokensForUser(userId: string, t: {
  access_token?: string | null
  refresh_token?: string | null
  expiry_date?: number | null
  scope?: string | null
  google_email?: string | null
}): Promise<void> {
  const supabase = createServiceClient()
  const row: Record<string, unknown> = {
    user_id: userId,
    access_token: t.access_token ?? null,
    expires_at: t.expiry_date ? new Date(t.expiry_date).toISOString() : null,
    scope: t.scope ?? null,
    updated_at: new Date().toISOString(),
  }
  if (t.refresh_token) row.refresh_token = t.refresh_token   // só grava quando veio um (preserva o antigo)
  if (t.google_email) row.google_email = t.google_email
  const { error } = await supabase.from('google_oauth_tokens').upsert(row, { onConflict: 'user_id' })
  if (error) console.error('[google-oauth] saveTokens upsert:', error.message)
}

// Apaga a conexão do usuário (service role).
export async function deleteTokensForUser(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('google_oauth_tokens').delete().eq('user_id', userId)
  return error ? { ok: false, reason: error.message } : { ok: true }
}

// Access token VÁLIDO do usuário: usa o salvo se ainda vale (folga de 60s), senão faz refresh
// (grant_type=refresh_token) e PERSISTE o novo access_token+expires_at. null se não conectou / sem refresh.
export async function getGoogleAccessTokenForUser(userId: string): Promise<string | null> {
  const row = await getTokenRow(userId)
  if (!row) return null
  const now = Date.now()
  const expMs = row.expires_at ? new Date(row.expires_at).getTime() : 0
  if (row.access_token && expMs - 60_000 > now) return row.access_token   // ainda válido
  if (!row.refresh_token) return null                                     // sem refresh → não dá p/ renovar
  const oauth = getOAuthClient(); if (!oauth) return null
  oauth.setCredentials({ refresh_token: row.refresh_token })
  try {
    const { token } = await oauth.getAccessToken()   // dispara o refresh
    if (!token) return null
    const expiry = oauth.credentials.expiry_date ?? null
    const supabase = createServiceClient()
    await supabase.from('google_oauth_tokens').update({
      access_token: token,
      expires_at: expiry ? new Date(expiry).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return token
  } catch (e) {
    console.error('[google-oauth] refresh FALHOU · user', userId, ':', (e as Error)?.message ?? e)
    return null
  }
}

// Cliente do Google Calendar autenticado COMO o usuário, no calendário 'primary'. null se não conectou.
export async function getUserCalendar(
  userId: string,
): Promise<{ calendar: calendar_v3.Calendar; calendarId: string } | null> {
  const accessToken = await getGoogleAccessTokenForUser(userId)
  if (!accessToken) return null
  const oauth = getOAuthClient(); if (!oauth) return null
  oauth.setCredentials({ access_token: accessToken })
  return { calendar: google.calendar({ version: 'v3', auth: oauth }), calendarId: 'primary' }
}

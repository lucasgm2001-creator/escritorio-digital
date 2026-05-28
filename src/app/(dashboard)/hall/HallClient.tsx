'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/utils'
import type { Activity, Notice } from '@/types'

interface Stats {
  totalLeads: number
  activeClients: number
  mrr: number
  pendingTasks: number
}

interface Props {
  initialActivities: Activity[]
  initialNotices: Notice[]
  userName: string
  userRole: string
  userId: string
  stats: Stats
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  client: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  payment: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  task: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  campaign: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
  system: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
    </svg>
  ),
}

const ACTIVITY_COLORS: Record<string, string> = {
  lead: 'bg-blue-50 text-blue-600',
  client: 'bg-indigo-50 text-indigo-600',
  payment: 'bg-green-50 text-green-600',
  task: 'bg-amber-50 text-amber-600',
  campaign: 'bg-purple-50 text-purple-600',
  system: 'bg-slate-50 text-slate-600',
}

const NOTICE_COLORS: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50',
  warning: 'border-amber-200 bg-amber-50',
  urgent: 'border-red-200 bg-red-50',
}

function computeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function computeWeekDays(): { label: string; date: number; isToday: boolean }[] {
  const now = new Date()
  const jsDay = now.getDay()
  const daysToMonday = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(now)
  monday.setDate(monday.getDate() + daysToMonday)
  const todayStr = now.toDateString()
  return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { label, date: d.getDate(), isToday: d.toDateString() === todayStr }
  })
}

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`
  return `R$ ${v.toLocaleString('pt-BR')}`
}

export function HallClient({ initialActivities, initialNotices, userName, userRole, userId, stats }: Props) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [notices, setNotices] = useState<Notice[]>(initialNotices)
  const [greeting, setGreeting] = useState('')
  const [today, setToday] = useState('')
  const [weekDays, setWeekDays] = useState<{ label: string; date: number; isToday: boolean }[]>([])
  const [onlineCount, setOnlineCount] = useState(1)
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', priority: 'info' as 'info' | 'warning' | 'urgent' })
  const [savingNotice, setSavingNotice] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const canPostNotice = userRole === 'admin' || userRole === 'financeiro'

  useEffect(() => {
    setGreeting(computeGreeting())
    setToday(new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }))
    setWeekDays(computeWeekDays())
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Realtime: activities + notices
    const dataChannel = supabase
      .channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        (payload) => setActivities(prev => [payload.new as Activity, ...prev.slice(0, 19)])
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' },
        (payload) => setNotices(prev => [payload.new as Notice, ...prev.slice(0, 9)])
      )
      .subscribe()

    // Presence: contador de usuários online
    const presenceChannel = supabase.channel('hall-presence', {
      config: { presence: { key: userId } },
    })
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: userId, name: userName, online_at: new Date().toISOString() })
        }
      })

    channelRef.current = presenceChannel

    return () => {
      supabase.removeChannel(dataChannel)
      supabase.removeChannel(presenceChannel)
    }
  }, [userId, userName])

  const handlePostNotice = async () => {
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) return
    setSavingNotice(true)
    const supabase = createClient()
    await supabase.from('notices').insert({
      title: noticeForm.title.trim(),
      content: noticeForm.content.trim(),
      priority: noticeForm.priority,
      author_id: userId,
      author_name: userName,
    })
    setNoticeForm({ title: '', content: '', priority: 'info' })
    setShowNoticeForm(false)
    setSavingNotice(false)
  }

  const statCards = [
    { label: 'Total de Leads',    value: stats.totalLeads.toString(),     sub: 'no pipeline',        color: 'text-blue-600' },
    { label: 'Clientes Ativos',   value: stats.activeClients.toString(),   sub: 'contratos ativos',   color: 'text-green-600' },
    { label: 'MRR Semanal',       value: fmt(stats.mrr),                   sub: 'receita semanal × 4', color: 'text-indigo-600' },
    { label: 'Tarefas Pendentes', value: stats.pendingTasks.toString(),    sub: 'aguardando ação',    color: 'text-amber-600' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header — saudação + online */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">
            {greeting ? `${greeting}, ${userName}` : userName}
          </h1>
          <p className="text-muted-foreground mt-0.5 capitalize text-sm">{today}</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-700">{onlineCount} online agora</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <Card key={stat.label} className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Feed de atividades */}
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-primary-900 text-base flex items-center gap-2">
              Atividades Recentes
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade ainda.</p>
            ) : activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[activity.type] ?? 'bg-slate-50 text-slate-600'}`}>
                  {ACTIVITY_ICONS[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{activity.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {activity.user_name && (
                      <>
                        <p className="text-xs text-muted-foreground">{activity.user_name}</p>
                        <span className="text-muted-foreground text-xs">·</span>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">{timeAgo(activity.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mural de avisos */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary-900 text-base">Mural de Avisos</CardTitle>
              {canPostNotice && (
                <button
                  onClick={() => setShowNoticeForm(!showNoticeForm)}
                  className="flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900 transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Postar
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Formulário de novo aviso */}
            {showNoticeForm && canPostNotice && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2.5 mb-4">
                <input
                  value={noticeForm.title}
                  onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Título do aviso"
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 bg-white"
                />
                <textarea
                  value={noticeForm.content}
                  onChange={e => setNoticeForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Mensagem..."
                  rows={2}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 resize-none bg-white"
                />
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {(['info', 'warning', 'urgent'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setNoticeForm(prev => ({ ...prev, priority: p }))}
                        className={`flex-1 py-1 rounded-md text-xs font-medium border transition-all ${
                          noticeForm.priority === p
                            ? p === 'info' ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : p === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-300'
                              : 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        {p === 'info' ? 'Info' : p === 'warning' ? 'Atenção' : 'Urgente'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handlePostNotice}
                    disabled={savingNotice || !noticeForm.title.trim()}
                    className="px-3 py-1 bg-primary-900 text-white rounded-lg text-xs font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors"
                  >
                    {savingNotice ? '...' : 'Publicar'}
                  </button>
                </div>
              </div>
            )}

            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum aviso.</p>
            ) : notices.map((notice) => (
              <div key={notice.id} className={`rounded-lg border p-3 ${NOTICE_COLORS[notice.priority] ?? 'border-border bg-muted'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{notice.title}</p>
                  <Badge
                    variant={notice.priority === 'info' ? 'default' : notice.priority === 'warning' ? 'warning' : 'destructive'}
                    className="text-xs"
                  >
                    {notice.priority === 'info' ? 'Info' : notice.priority === 'warning' ? 'Atenção' : 'Urgente'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{notice.content}</p>
                {notice.author_name && (
                  <p className="text-xs text-muted-foreground mt-1">— {notice.author_name} · {timeAgo(notice.created_at)}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Semana atual */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-primary-900 text-base">Semana Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {(weekDays.length > 0
              ? weekDays
              : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map(label => ({ label, date: 0, isToday: false }))
            ).map(({ label, date, isToday }) => (
              <div key={label} className={`rounded-xl p-3 text-center border transition-colors ${
                isToday ? 'bg-primary-900 text-white border-primary-900' : 'bg-muted border-border hover:bg-muted/80'
              }`}>
                <p className={`text-xs font-medium ${isToday ? 'text-primary-200' : 'text-muted-foreground'}`}>{label}</p>
                <p className={`text-xl font-bold mt-1 ${isToday ? 'text-white' : 'text-foreground'}`}>
                  {date || '—'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

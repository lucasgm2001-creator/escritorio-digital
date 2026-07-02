import type { CommercialReport } from '@/core/reporting/types'
import type { CommercialDashboardVM } from '@/core/metrics/types'

// Gerador do PDF Executivo Comercial. Recebe os view-models PRONTOS (ReportingService +
// DashboardMetricsService) e apenas os FORMATA/desenha — nenhum cálculo de KPI, nenhum acesso a banco.
const GREEN: [number, number, number] = [101, 163, 13]
const DARK: [number, number, number] = [25, 25, 25]
const GREY: [number, number, number] = [110, 110, 110]
const L = 14
const R = 196

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const pct = (r: number): string => `${Math.round(r * 100)}%`

export async function buildExecutivePdf(input: {
  dashboard: CommercialDashboardVM
  report: CommercialReport
  workspace: string | null
  user: string | null
}): Promise<void> {
  const { dashboard: d, report: rp, workspace, user } = input
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF()
  let y = 18

  const afterTable = (fallback: number): number =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback
  const ensure = (needed: number) => { if (y + needed > 285) { doc.addPage(); y = 18 } }
  const heading = (title: string) => {
    ensure(16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(title, L, y); y += 5
  }

  // ---- Cabeçalho ----
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]); doc.text('Escritório Digital', L, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  doc.text('Relatório Executivo Comercial', L, y + 6)
  doc.text(workspace ?? '—', R, y, { align: 'right' })
  doc.text(`Período: ${rp.period.label}`, R, y + 5, { align: 'right' })
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}${user ? ` · ${user}` : ''}`, R, y + 10, { align: 'right' })
  y += 16
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 8

  // ---- Resumo executivo ----
  heading('Resumo executivo')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  const summary = [
    `${d.leadsActive} leads ativos · ${d.leadsNew} novos · ${d.leadsStuck} parados.`,
    `${d.meetings} reuniões · ${d.proposals} propostas · ${d.closes} fechamentos (conversão ${pct(d.conversionRate)}).`,
    `Receita realizada ${usd(d.revenueRealized)} · prevista ${usd(d.revenueForecast)} · perdida ${usd(d.revenueLost)}.`,
  ]
  for (const line of summary) { doc.text(line, L, y); y += 5 }
  y += 3

  // ---- KPIs ----
  heading('KPIs')
  const kpis: [string, string][] = [
    ['Leads ativos', String(d.leadsActive)], ['Leads novos', String(d.leadsNew)], ['Leads parados', String(d.leadsStuck)],
    ['Tempo médio', `${d.avgDaysAsLead}d`], ['Reuniões', String(d.meetings)], ['No-shows', String(d.noShows)],
    ['Propostas', String(d.proposals)], ['Fechamentos', String(d.closes)], ['Conversão', pct(d.conversionRate)],
    ['Ticket médio', usd(d.avgTicket)], ['Receita prevista', usd(d.revenueForecast)], ['Receita realizada', usd(d.revenueRealized)],
    ['Receita perdida', usd(d.revenueLost)],
  ]
  const kpiRows: string[][] = []
  for (let i = 0; i < kpis.length; i += 3) {
    const chunk = kpis.slice(i, i + 3)
    kpiRows.push(chunk.flatMap(([k, v]) => [k, v]).concat(Array(6 - chunk.length * 2).fill('')))
  }
  autoTable(doc, {
    startY: y, body: kpiRows, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { textColor: GREY }, 1: { fontStyle: 'bold', textColor: DARK },
      2: { textColor: GREY }, 3: { fontStyle: 'bold', textColor: DARK },
      4: { textColor: GREY }, 5: { fontStyle: 'bold', textColor: DARK },
    },
  })
  y = afterTable(y) + 8

  // ---- Pipeline por movimentação ----
  heading('Pipeline — movimentações no período')
  autoTable(doc, {
    startY: y, head: [['De', 'Para', 'Movimentações']],
    body: rp.movements.length ? rp.movements.map(m => [m.from ?? '—', m.to, String(m.count)]) : [['—', 'Sem movimentações', '0']],
    styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
  })
  y = afterTable(y) + 8

  // ---- Conversões ----
  heading('Conversões')
  autoTable(doc, {
    startY: y, head: [['Etapa', 'Taxa']], body: rp.conversions.map(c => [c.label, pct(c.rate)]),
    styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] },
  })
  y = afterTable(y) + 8

  // ---- Ranking de etapas e gargalos ----
  heading('Ranking de etapas e gargalos')
  autoTable(doc, {
    startY: y, head: [['Etapa', 'Leads', 'Tempo médio']],
    body: rp.funnel.length ? rp.funnel.map(f => [f.stage, String(f.count), f.avgDays != null ? `${f.avgDays}d` : '—']) : [['—', '0', '—']],
    styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
  })
  y = afterTable(y) + 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  ensure(8); doc.text(`Leads parados (> 7 dias): ${rp.stuckLeads}`, L, y); y += 8

  // ---- Gráficos (primitivos seguros: rect/line/circle; máximos protegidos contra divisão por zero) ----
  heading('Gráficos')
  const subTitle = (txt: string) => { ensure(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(DARK[0], DARK[1], DARK[2]); doc.text(txt, L, y); y += 5 }
  const maxOf = (arr: number[]): number => arr.reduce((m, v) => (v > m ? v : m), 1)

  // Funil (barras decrescentes)
  subTitle('Funil')
  const funnel: [string, number][] = [['Leads', rp.kpis.totalLeads], ['Reuniões', d.meetings], ['Propostas', d.proposals], ['Fechamentos', d.closes]]
  const funMax = maxOf(funnel.map(f => f[1]))
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  for (const [label, val] of funnel) {
    ensure(9)
    const w = Math.max(1, (val / funMax) * 120)
    doc.setTextColor(GREY[0], GREY[1], GREY[2]); doc.text(label, L, y + 5)
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]); doc.rect(45, y, w, 6, 'F')
    doc.setTextColor(DARK[0], DARK[1], DARK[2]); doc.text(String(val), 45 + w + 2, y + 5)
    y += 9
  }
  y += 4

  // Barras por etapa (entrada)
  subTitle('Entrada por etapa')
  const stageBars = rp.funnel.slice(0, 8)
  const stageMax = maxOf(stageBars.map(s => s.count))
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  for (const s of stageBars) {
    ensure(9)
    const w = Math.max(1, (s.count / stageMax) * 110)
    doc.setTextColor(GREY[0], GREY[1], GREY[2]); doc.text(s.stage.slice(0, 18), L, y + 5)
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]); doc.rect(55, y, w, 6, 'F')
    doc.setTextColor(DARK[0], DARK[1], DARK[2]); doc.text(String(s.count), 55 + w + 2, y + 5)
    y += 9
  }
  y += 4

  // Resultado (proporção Ganhos / Perdidos / Em aberto)
  subTitle('Resultado')
  const won = d.closes, lost = rp.kpis.lost, open = d.leadsActive
  const totalR = Math.max(1, won + lost + open)
  const segs: [number, [number, number, number], string][] = [[won, GREEN, 'Ganhos'], [lost, [200, 60, 60], 'Perdidos'], [open, [150, 150, 150], 'Em aberto']]
  ensure(16)
  let segX = L
  for (const [val, color] of segs) {
    const w = (val / totalR) * 150
    if (w > 0) { doc.setFillColor(color[0], color[1], color[2]); doc.rect(segX, y, w, 7, 'F'); segX += w }
  }
  y += 11
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  let legX = L
  for (const [val, color, lbl] of segs) {
    doc.setFillColor(color[0], color[1], color[2]); doc.rect(legX, y - 3, 3, 3, 'F')
    doc.setTextColor(GREY[0], GREY[1], GREY[2]); doc.text(`${lbl}: ${val}`, legX + 5, y)
    legX += 45
  }
  y += 8

  // Linha temporal simples (progressão do funil)
  subTitle('Progressão')
  const pts = funnel.map(f => f[1])
  const ptMax = maxOf(pts)
  const cH = 22
  ensure(cH + 12)
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(L, y + cH, L + 160, y + cH)
  let prevX = 0, prevY = 0
  for (let i = 0; i < pts.length; i++) {
    const px = L + (160 * i) / Math.max(1, pts.length - 1)
    const py = y + cH - (pts[i] / ptMax) * cH
    if (i > 0) { doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]); doc.setLineWidth(0.6); doc.line(prevX, prevY, px, py) }
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]); doc.circle(px, py, 1.3, 'F')
    doc.setFontSize(7); doc.setTextColor(GREY[0], GREY[1], GREY[2]); doc.text(funnel[i][0].slice(0, 8), px - 5, y + cH + 4)
    prevX = px; prevY = py
  }
  y += cH + 10

  // ---- Insights (sem IA — regras automáticas do ReportingService) ----
  heading('Insights')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  if (rp.insights.length === 0) { ensure(6); doc.text('Sem alertas no período.', L, y); y += 6 }
  else for (const ins of rp.insights) { ensure(7); doc.text(`• ${ins.message}`, L, y, { maxWidth: R - L }); y += 7 }

  doc.save(`relatorio-executivo-${rp.period.label.replace(/[^0-9a-zA-Z]+/g, '-').toLowerCase()}.pdf`)
}

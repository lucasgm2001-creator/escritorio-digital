import type { CommercialReport } from '@/core/reporting/types'

// Gerador do PDF Executivo Comercial. Recebe o view-model PRONTO (ReportingService) e apenas o FORMATA/desenha
// — nenhum cálculo de KPI, nenhum acesso a banco.
//
// UX-COMPENSATION-CLIENT-REPORTS-001 (P3): o relatório agora respeita EXATAMENTE a janela selecionada. Antes ele
// misturava o DashboardVM (all-time, sem período) com o CommercialReport (period-scoped), então os destaques,
// o resumo, a tabela de KPIs e os gráficos mostravam números de TODO o histórico — vazando fora do período e
// poluindo o documento. Agora consome SÓ o CommercialReport (period-scoped) e enxuga o conteúdo (2 gráficos,
// menos repetição). Seções de "pipeline atual" (gargalos/parados) seguem sendo um retrato do AGORA, rotuladas.
const GREEN: [number, number, number] = [101, 163, 13]
const DARK: [number, number, number] = [25, 25, 25]
const GREY: [number, number, number] = [110, 110, 110]
const RED: [number, number, number] = [200, 60, 60]
const L = 14
const R = 196

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const pct = (r: number): string => `${Math.round(r * 100)}%`

export async function buildExecutivePdf(input: {
  report: CommercialReport
  workspace: string | null
  user: string | null
}): Promise<void> {
  const { report: rp, workspace, user } = input
  const k = rp.kpis
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF()
  const generatedAt = new Date().toLocaleDateString('pt-BR')

  const afterTable = (fallback: number): number =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback

  // ---- Capa (página de diretoria) ----
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]); doc.rect(0, 0, 210, 5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2])
  doc.text('Escritório Digital', L, 42)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(32); doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text('Relatório', L, 92); doc.text('Executivo Comercial', L, 106)
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]); doc.setLineWidth(1); doc.line(L, 116, L + 64, 116)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  doc.text(`Período · ${rp.period.label}`, L, 132)
  doc.text(`Workspace · ${workspace ?? '—'}`, L, 140)
  doc.text(`Gerado em ${generatedAt}${user ? ` · ${user}` : ''}`, L, 148)

  // Destaques na capa — 4 números-chave DO PERÍODO (só formatação de KPIs já calculados).
  const highlights: [string, string][] = [
    ['Conversão', pct(k.conversionRate)], ['Fechamentos', String(k.won)],
    ['Receita no período', usd(k.totalValue)], ['Leads novos', String(k.newLeads)],
  ]
  let hx = L
  const hw = 44
  for (const [label, val] of highlights) {
    doc.setDrawColor(222, 222, 222); doc.setLineWidth(0.3); doc.setFillColor(248, 249, 244)
    doc.roundedRect(hx, 170, hw, 26, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(val, hx + 4, 182, { maxWidth: hw - 8 })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GREY[0], GREY[1], GREY[2])
    doc.text(label.toUpperCase(), hx + 4, 190, { maxWidth: hw - 8 })
    hx += hw + 3
  }

  // ---- Conteúdo começa na página 2 (a capa fica limpa) ----
  doc.addPage()
  let y = 22

  const ensure = (needed: number) => { if (y + needed > 278) { doc.addPage(); y = 22 } }
  const heading = (title: string) => {
    ensure(16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(title, L, y)
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]); doc.setLineWidth(0.4); doc.line(L, y + 1.5, L + 16, y + 1.5)
    y += 6
  }

  // ---- Resumo executivo (período) ----
  heading('Resumo executivo')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  const summary = [
    `${k.newLeads} leads novos · ${k.meetingsHeld} reuniões · ${k.proposals} propostas · ${k.won} fechamentos (conversão ${pct(k.conversionRate)}).`,
    `Receita no período ${usd(k.totalValue)} · ticket médio ${usd(k.avgTicket)} · ciclo médio ${k.avgCycleDays}d.`,
  ]
  for (const line of summary) { ensure(6); doc.text(line, L, y); y += 5 }
  y += 3

  // ---- Indicadores do período ----
  heading('Indicadores do período')
  const kpis: [string, string][] = [
    ['Leads novos', String(k.newLeads)], ['Reuniões marcadas', String(k.meetingsScheduled)], ['Reuniões realizadas', String(k.meetingsHeld)],
    ['No-shows', String(k.noShow)], ['Propostas', String(k.proposals)], ['Fechamentos', String(k.won)],
    ['Conversão', pct(k.conversionRate)], ['Ticket médio', usd(k.avgTicket)], ['Ciclo médio', `${k.avgCycleDays}d`],
    ['Receita no período', usd(k.totalValue)], ['Perdidos', String(k.lost)],
  ]
  const kpiRows: string[][] = []
  for (let i = 0; i < kpis.length; i += 3) {
    const chunk = kpis.slice(i, i + 3)
    kpiRows.push(chunk.flatMap(([kk, v]) => [kk, v]).concat(Array(6 - chunk.length * 2).fill('')))
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

  // ---- Pipeline por movimentação (período) ----
  heading('Pipeline — movimentações no período')
  autoTable(doc, {
    startY: y, head: [['De', 'Para', 'Movimentações']],
    body: rp.movements.length ? rp.movements.map(m => [m.from ?? '—', m.to, String(m.count)]) : [['—', 'Sem movimentações', '0']],
    styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
  })
  y = afterTable(y) + 8

  // ---- Conversões (período) ----
  heading('Conversões')
  autoTable(doc, {
    startY: y, head: [['Etapa', 'Taxa']], body: rp.conversions.map(c => [c.label, pct(c.rate)]),
    styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] },
  })
  y = afterTable(y) + 8

  // ---- Etapas & gargalos (RETRATO DO PIPELINE ATUAL, não do período) ----
  heading('Etapas & gargalos (pipeline atual)')
  const gargalos = rp.funnel.filter(f => f.count > 0)   // só etapas com leads — 0-count é ruído
  autoTable(doc, {
    startY: y, head: [['Etapa', 'Leads', 'Tempo médio']],
    body: gargalos.length ? gargalos.map(f => [f.stage, String(f.count), f.avgDays != null ? `${f.avgDays}d` : '—']) : [['—', '0', '—']],
    styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
  })
  y = afterTable(y) + 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  ensure(8); doc.text(`Leads parados / críticos (> 7 dias): ${rp.stuckLeads}`, L, y); y += 8

  // ---- Gráficos (2, período; primitivos seguros: rect/line; máximos protegidos contra divisão por zero) ----
  heading('Gráficos')
  const subTitle = (txt: string) => { ensure(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(DARK[0], DARK[1], DARK[2]); doc.text(txt, L, y); y += 5 }
  const maxOf = (arr: number[]): number => arr.reduce((m, v) => (v > m ? v : m), 1)

  // Funil do período (barras decrescentes) — 100% period-scoped.
  subTitle('Funil do período')
  const funnel: [string, number][] = [['Leads novos', k.newLeads], ['Reuniões', k.meetingsHeld], ['Propostas', k.proposals], ['Fechamentos', k.won]]
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

  // Resultado do período (proporção Ganhos / Perdidos) — só o que é do período (nada de "em aberto" all-time).
  subTitle('Resultado do período')
  const won = k.won, lost = k.lost
  const totalR = Math.max(1, won + lost)
  const segs: [number, [number, number, number], string][] = [[won, GREEN, 'Ganhos'], [lost, RED, 'Perdidos']]
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

  // ---- Insights (sem IA — regras automáticas do ReportingService, período) ----
  heading('Insights')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(GREY[0], GREY[1], GREY[2])
  if (rp.insights.length === 0) { ensure(6); doc.text('Sem alertas no período.', L, y); y += 6 }
  else for (const ins of rp.insights) { ensure(7); doc.text(`• ${ins.message}`, L, y, { maxWidth: R - L }); y += 7 }

  // ---- Cabeçalho + rodapé corridos com numeração (páginas de conteúdo; capa fica limpa) ----
  const pages = doc.getNumberOfPages()
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(GREEN[0], GREEN[1], GREEN[2])
    doc.text('Escritório Digital', L, 12)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(GREY[0], GREY[1], GREY[2])
    doc.text('Relatório Executivo Comercial', R, 12, { align: 'right' })
    doc.setDrawColor(226, 226, 226); doc.setLineWidth(0.3); doc.line(L, 15, R, 15)
    doc.line(L, 288, R, 288)
    doc.setFontSize(7.5); doc.setTextColor(GREY[0], GREY[1], GREY[2])
    doc.text(`${rp.period.label}${workspace ? ` · ${workspace}` : ''}`, L, 293)
    doc.text(`Página ${p - 1} de ${pages - 1}`, R, 293, { align: 'right' })
  }

  doc.save(`relatorio-executivo-${rp.period.label.replace(/[^0-9a-zA-Z]+/g, '-').toLowerCase()}.pdf`)
}

import type { CommercialReport } from '@/core/reporting/types'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'

// Gerador do PDF Executivo Comercial (EXECUTIVE-METRICS-004). Recebe os view-models PRONTOS — exec
// (ExecutiveMetricsService, fonte única) + report (ReportingService, funil/insights). NÃO calcula KPI nem toca
// no banco: os MESMOS números da tela do Relatório → PDF = tela 1:1. Definições canônicas: Receita Recebida =
// client_payments; Valor Fechado = deals; nunca misturados. Layout limpo em 2 páginas; seção sem dado não aparece.
const GREEN: [number, number, number] = [101, 163, 13]
const DARK: [number, number, number] = [25, 25, 25]
const GREY: [number, number, number] = [110, 110, 110]
const L = 14
const R = 196

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const pct = (whole: number): string => `${Math.round(whole)}%`   // conversão do exec já vem 0..100

export async function buildExecutivePdf(input: {
  exec: ExecutiveMetricsVM
  report: CommercialReport
  workspace: string | null
  user: string | null
}): Promise<void> {
  const { exec, report: rp, workspace, user } = input
  const k = rp.kpis
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF()
  const generatedAt = new Date().toLocaleDateString('pt-BR')

  const afterTable = (fallback: number): number =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback
  let y = 0
  const ensure = (needed: number) => { if (y + needed > 278) { doc.addPage(); y = 22 } }
  const heading = (title: string) => {
    ensure(18)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...DARK)
    doc.text(title, L, y)
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.5); doc.line(L, y + 2, L + 18, y + 2)
    y += 9   // mais respiro entre o título e o conteúdo da seção
  }

  // ══════════════ PÁGINA 1 — Resumo executivo + KPIs principais ══════════════
  doc.setFillColor(...GREEN); doc.rect(0, 0, 210, 5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...GREEN); doc.text('Escritório Digital', L, 20)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...DARK); doc.text('Relatório Executivo Comercial', L, 33)
  doc.setDrawColor(...GREEN); doc.setLineWidth(1); doc.line(L, 38, L + 60, 38)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GREY)
  doc.text(`Período · ${exec.periodLabel}`, L, 47)
  doc.text(`Workspace · ${workspace ?? '—'}   ·   Gerado em ${generatedAt}${user ? ` · ${user}` : ''}`, L, 53)

  y = 66
  heading('Resumo executivo')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GREY)
  const summary = [
    `${k.newLeads} leads recebidos · ${k.interagiram} interagiram · ${k.meetingsScheduled} reuniões · ${k.proposals} propostas · ${k.won} fechamentos (conversão ${pct(exec.conversao)}).`,
    `Receita recebida ${usd(exec.receitaRecebida)} · valor fechado ${usd(exec.valorFechado)} · prevista ${usd(exec.receitaPrevista)} · ticket médio ${usd(exec.ticketMedio)}.`,
    `Carteira: MRR ${usd(exec.mrr)} · ARR ${usd(exec.arr)} · ${exec.clientesAtivos} clientes ativos · ${exec.clientesNovos} novos no período.`,
  ]
  for (const line of summary) { ensure(7); doc.text(line, L, y, { maxWidth: R - L }); y += 6.5 }
  y += 5

  heading('KPIs principais')
  const kpis: [string, string][] = [
    ['Receita Recebida', usd(exec.receitaRecebida)], ['Valor Fechado', usd(exec.valorFechado)], ['Receita Prevista', usd(exec.receitaPrevista)],
    ['MRR', usd(exec.mrr)], ['ARR', usd(exec.arr)], ['Ticket Médio', usd(exec.ticketMedio)],
    ['Conversão', pct(exec.conversao)], ['Leads recebidos', String(k.newLeads)], ['Interagiram', String(k.interagiram)],
    ['Reuniões marcadas', String(k.meetingsScheduled)], ['Propostas', String(k.proposals)], ['Clientes fechados', String(k.won)],
  ]
  const kpiRows: string[][] = []
  for (let i = 0; i < kpis.length; i += 3) {
    const chunk = kpis.slice(i, i + 3)
    kpiRows.push(chunk.flatMap(([kk, v]) => [kk, v]).concat(Array(6 - chunk.length * 2).fill('')))
  }
  autoTable(doc, {
    startY: y, body: kpiRows, theme: 'grid', styles: { fontSize: 9, cellPadding: 3.2 },
    columnStyles: {
      0: { textColor: GREY }, 1: { fontStyle: 'bold', textColor: DARK },
      2: { textColor: GREY }, 3: { fontStyle: 'bold', textColor: DARK },
      4: { textColor: GREY }, 5: { fontStyle: 'bold', textColor: DARK },
    },
  })

  // ══════════════ PÁGINA 2 — Receita + Funil + Gargalos + Atenção ══════════════
  doc.addPage(); y = 22

  // Receita por vendedor / plano — só quando há receita recebida no período.
  if (exec.receitaPorVendedor.length > 0) {
    heading('Receita por vendedor')
    autoTable(doc, {
      startY: y, head: [['Vendedor', 'Recebido', 'Clientes']],
      body: exec.receitaPorVendedor.map(s => [s.name, usd(s.value), String(s.count)]),
      styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
    })
    y = afterTable(y) + 7
  }
  if (exec.receitaPorPlano.length > 0) {
    heading('Receita por plano')
    autoTable(doc, {
      startY: y, head: [['Plano', 'Recebido', 'Clientes']],
      body: exec.receitaPorPlano.map(p => [p.plan, usd(p.value), String(p.count)]),
      styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
    })
    y = afterTable(y) + 7
  }

  // Funil do período (barras Leads → Reuniões → Propostas → Fechamentos).
  heading('Funil do período')
  const funil: [string, number][] = [['Leads recebidos', k.newLeads], ['Reuniões', k.meetingsScheduled], ['Propostas', k.proposals], ['Fechamentos', k.won]]
  const funMax = funil.reduce((m, f) => (f[1] > m ? f[1] : m), 1)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  for (const [label, val] of funil) {
    ensure(9)
    const w = Math.max(1, (val / funMax) * 120)
    doc.setTextColor(...GREY); doc.text(label, L, y + 5)
    doc.setFillColor(...GREEN); doc.rect(48, y, w, 6, 'F')
    doc.setTextColor(...DARK); doc.text(String(val), 48 + w + 2, y + 5)
    y += 9
  }
  y += 4

  // Etapas & gargalos (retrato do pipeline ATUAL) — só etapas com leads.
  const gargalos = rp.funnel.filter(f => f.count > 0)
  if (gargalos.length > 0) {
    heading('Etapas & gargalos (pipeline atual)')
    autoTable(doc, {
      startY: y, head: [['Etapa', 'Leads', 'Tempo médio']],
      body: gargalos.map(f => [f.stage, String(f.count), f.avgDays != null ? `${f.avgDays}d` : '—']),
      styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
    })
    y = afterTable(y) + 4
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
    ensure(8); doc.text(`Leads parados / críticos (> 7 dias): ${rp.stuckLeads}`, L, y); y += 8
  }

  // Pontos de atenção (insights automáticos, sem IA) — só quando há.
  if (rp.insights.length > 0) {
    heading('Pontos de atenção')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
    for (const ins of rp.insights) { ensure(7); doc.text(`• ${ins.message}`, L, y, { maxWidth: R - L }); y += 7 }
  }

  // ---- Cabeçalho + rodapé com numeração (todas as páginas) ----
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(226, 226, 226); doc.setLineWidth(0.3); doc.line(L, 288, R, 288)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY)
    doc.text(`${exec.periodLabel}${workspace ? ` · ${workspace}` : ''}`, L, 293)
    doc.text(`Página ${p} de ${pages}`, R, 293, { align: 'right' })
  }

  doc.save(`relatorio-executivo-${exec.periodLabel.replace(/[^0-9a-zA-Z]+/g, '-').toLowerCase()}.pdf`)
}

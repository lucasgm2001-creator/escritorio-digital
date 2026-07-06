import type { CommercialReport } from '@/core/reporting/types'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'

// Gerador do PDF Executivo Comercial (EXECUTIVE-METRICS-004 · REPORTS-PERIOD-TRUTH-001). Recebe os view-models
// PRONTOS — exec (ExecutiveMetricsService, fonte única, JANELA atual) + execPrev (mesma fonte, período ANTERIOR
// de mesma duração) + report (ReportingService: funil acumulativo/comparativo/insights). NÃO calcula KPI nem
// toca no banco: os MESMOS números da tela do Relatório → PDF = tela 1:1. Receita Recebida = client_payments no
// período; Valor Fechado = deals no período; nunca all-time. Carteira (MRR/ARR/ativos) é SNAPSHOT — sai do topo,
// vai para o rodapé da P3, rotulada "não é do período". 3 páginas; seção sem dado não aparece.
const GREEN: [number, number, number] = [101, 163, 13]
const DARK: [number, number, number] = [25, 25, 25]
const GREY: [number, number, number] = [110, 110, 110]
const POS: [number, number, number] = [56, 142, 60]   // Δ positivo
const NEG: [number, number, number] = [192, 57, 43]    // Δ negativo
const L = 14
const R = 196

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const pct = (whole: number): string => `${Math.round(whole)}%`   // conversão do exec já vem 0..100
const signInt = (d: number): string => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))}`
const signUsd = (d: number): string => `${d >= 0 ? '+' : '−'}${usd(Math.abs(d))}`
const signPp = (d: number): string => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d))} pp`

export async function buildExecutivePdf(input: {
  exec: ExecutiveMetricsVM
  execPrev: ExecutiveMetricsVM
  report: CommercialReport
  workspace: string | null
  user: string | null
}): Promise<void> {
  const { exec, execPrev, report: rp, workspace, user } = input
  const k = rp.kpis
  const cmp = rp.comparison   // funil do período anterior (mesma duração) — pode ser null
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
    y += 9   // respiro entre título e conteúdo
  }

  // ════════ PÁGINA 1 — Resumo do PERÍODO + KPIs do período + comparação com período anterior ════════
  doc.setFillColor(...GREEN); doc.rect(0, 0, 210, 5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...GREEN); doc.text('Escritório Digital', L, 20)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...DARK); doc.text('Relatório Executivo Comercial', L, 33)
  doc.setDrawColor(...GREEN); doc.setLineWidth(1); doc.line(L, 38, L + 60, 38)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GREY)
  doc.text(`Período · ${exec.periodLabel}`, L, 47)
  doc.text(`Workspace · ${workspace ?? '—'}   ·   Gerado em ${generatedAt}${user ? ` · ${user}` : ''}`, L, 53)

  y = 66
  heading('Resumo do período')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GREY)
  const summary = [
    `${k.newLeads} leads recebidos · ${k.interagiram} interagiram · ${k.meetingsScheduled} reuniões · ${k.proposals} propostas · ${k.won} vendas (conversão ${pct(exec.conversao)}).`,
    `Receita recebida ${usd(exec.receitaRecebida)} · valor fechado ${usd(exec.valorFechado)} · prevista ${usd(exec.receitaPrevista)} · ticket ${usd(exec.ticketMedio)}.`,
  ]
  for (const line of summary) { ensure(7); doc.text(line, L, y, { maxWidth: R - L }); y += 6.5 }
  y += 5

  heading('KPIs principais do período')
  const kpis: [string, string][] = [
    ['Receita Recebida', usd(exec.receitaRecebida)], ['Valor Fechado', usd(exec.valorFechado)], ['Receita Prevista', usd(exec.receitaPrevista)],
    ['Ticket Médio', usd(exec.ticketMedio)], ['Conversão', pct(exec.conversao)], ['Leads recebidos', String(k.newLeads)],
    ['Interagiram', String(k.interagiram)], ['Reuniões marcadas', String(k.meetingsScheduled)], ['Propostas em análise', String(k.proposals)],
    ['Vendas concluídas', String(k.won)], ['Não interagiram', String(k.naoInteragiram)], ['No-show', String(k.noShow)],
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
  y = afterTable(y) + 9

  // Comparação com o período anterior (mesma duração) — leads/interações/reuniões/propostas/vendas/receita/conversão.
  if (cmp) {
    heading('Comparação com o período anterior')
    const cRows: [string, string, string, number][] = [
      ['Leads recebidos', String(k.newLeads), String(cmp.newLeads), k.newLeads - cmp.newLeads],
      ['Interações', String(k.interagiram), String(cmp.interagiram), k.interagiram - cmp.interagiram],
      ['Reuniões marcadas', String(k.meetingsScheduled), String(cmp.meetingsScheduled), k.meetingsScheduled - cmp.meetingsScheduled],
      ['Propostas em análise', String(k.proposals), String(cmp.proposals), k.proposals - cmp.proposals],
      ['Vendas concluídas', String(k.won), String(cmp.won), k.won - cmp.won],
    ]
    const body = cRows.map(([label, cur, prev, d]) => [label, cur, prev, signInt(d)])
    body.push(['Receita recebida', usd(exec.receitaRecebida), usd(execPrev.receitaRecebida), signUsd(exec.receitaRecebida - execPrev.receitaRecebida)])
    body.push(['Conversão', pct(exec.conversao), pct(execPrev.conversao), signPp(exec.conversao - execPrev.conversao)])
    const deltaVals = [...cRows.map(r => r[3]), exec.receitaRecebida - execPrev.receitaRecebida, exec.conversao - execPrev.conversao]
    autoTable(doc, {
      startY: y, head: [['Métrica', 'Atual', 'Anterior', 'Δ']],
      body,
      styles: { fontSize: 8.5, cellPadding: 2.2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
      columnStyles: { 1: { fontStyle: 'bold', textColor: DARK }, 3: { fontStyle: 'bold', halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const d = deltaVals[data.row.index]
          data.cell.styles.textColor = d > 0 ? POS : d < 0 ? NEG : GREY
        }
      },
    })
    y = afterTable(y) + 4
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...GREY)
    ensure(6); doc.text('Período anterior = janela imediatamente anterior, de mesma duração.', L, y); y += 6
  }

  // ════════ PÁGINA 2 — Funil acumulativo + gráfico + gargalos do período ════════
  doc.addPage(); y = 22

  // Funil ACUMULATIVO (Parte 3): Leads → Interagiram → Reuniões → Propostas → Vendas. Cada etapa conta quem
  // ALCANÇOU aquela etapa ou adiante (um lead que pulou etapas conta nas anteriores).
  heading('Funil do período (acumulado)')
  const steps = rp.cumulativeFunnel.length
    ? rp.cumulativeFunnel.map(s => [s.label, s.count] as [string, number])
    : ([['Leads recebidos', k.newLeads], ['Interagiram', k.interagiram], ['Reuniões marcadas', k.meetingsScheduled], ['Propostas em análise', k.proposals], ['Vendas concluídas', k.won]] as [string, number][])
  const funMax = steps.reduce((m, f) => (f[1] > m ? f[1] : m), 1)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  for (const [label, val] of steps) {
    ensure(10)
    const w = Math.max(1, (val / funMax) * 118)
    doc.setTextColor(...GREY); doc.text(label, L, y + 5)
    doc.setFillColor(...GREEN); doc.rect(58, y, w, 6.5, 'F')
    doc.setTextColor(...DARK); doc.text(String(val), 58 + w + 2, y + 5)
    y += 10
  }
  y += 5

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

  // ════════ PÁGINA 3 — Receita por vendedor + por plano + pontos de atenção ════════
  doc.addPage(); y = 22

  if (exec.receitaPorVendedor.length > 0) {
    heading('Receita por vendedor (período)')
    autoTable(doc, {
      startY: y, head: [['Vendedor', 'Recebido', 'Clientes']],
      body: exec.receitaPorVendedor.map(s => [s.name, usd(s.value), String(s.count)]),
      styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
    })
    y = afterTable(y) + 7
  }
  if (exec.receitaPorPlano.length > 0) {
    heading('Receita por plano (período)')
    autoTable(doc, {
      startY: y, head: [['Plano', 'Recebido', 'Clientes']],
      body: exec.receitaPorPlano.map(p => [p.plan, usd(p.value), String(p.count)]),
      styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
    })
    y = afterTable(y) + 7
  }

  // Pontos de atenção (insights automáticos, sem IA) — só quando há.
  if (rp.insights.length > 0) {
    heading('Pontos de atenção')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
    for (const ins of rp.insights) { ensure(7); doc.text(`• ${ins.message}`, L, y, { maxWidth: R - L }); y += 7 }
    y += 3
  }

  // Carteira atual — SNAPSHOT, não é do período. Fica no rodapé da P3, rotulada.
  heading('Carteira atual (snapshot — não é do período)')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
  ensure(7)
  doc.text(`MRR ${usd(exec.mrr)} · ARR ${usd(exec.arr)} · ${exec.clientesAtivos} clientes ativos · ${exec.clientesNovos} novos no período.`, L, y, { maxWidth: R - L })

  // ---- Rodapé com numeração (todas as páginas) ----
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

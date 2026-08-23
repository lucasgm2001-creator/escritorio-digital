import type { CommercialReport } from '@/core/reporting/types'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'

// Gerador do PDF Executivo Comercial (EXECUTIVE-METRICS-004 · PDF-ENXUTO-001). Recebe os view-models PRONTOS —
// exec (ExecutiveMetricsService, JANELA atual) + execPrev (mesma fonte, período ANTERIOR de mesma duração) +
// report (ReportingService). NÃO calcula KPI nem toca no banco: os MESMOS números da tela → PDF 1:1.
//
// ENXUTO (PDF-ENXUTO-001): eram 3 páginas — 13 KPIs num grid, gráfico de barras do funil, tabela de gargalos
// do pipeline atual, aquisição sempre presente, receita por vendedor e por plano, snapshot da carteira. Muita
// coisa repetia a mesma informação em formatos diferentes (o gráfico de barras é o mesmo funil da tabela de
// KPIs) e outra parte não era do período (gargalos, carteira). Agora é UMA página, na mesma ordem da aba
// Métricas — o que foi feito, quão bem converteu, quanto deu — mais a comparação com o período anterior.
//
// Seções condicionais aparecem só quando têm conteúdo: aquisição exige investimento lançado; receita por
// vendedor exige mais de um vendedor (com um só, a linha repete o total). Nada de seção vazia ocupando página.
const GREEN: [number, number, number] = [101, 163, 13]
const DARK: [number, number, number] = [25, 25, 25]
const GREY: [number, number, number] = [110, 110, 110]
const POS: [number, number, number] = [56, 142, 60]   // Δ positivo
const NEG: [number, number, number] = [192, 57, 43]    // Δ negativo
const L = 14
const R = 196

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const pct = (whole: number): string => `${Math.round(whole)}%`   // conversão do exec já vem 0..100
// A fonte Helvetica embutida no jsPDF não cobre U+2212 (sinal de menos matemático) nem
// o delta grego com confiabilidade. Use apenas glifos WinAnsi/ASCII no conteúdo do PDF:
// evita o caractere quebrado que aparecia como aspas antes dos valores negativos.
const signInt = (d: number): string => `${d >= 0 ? '+' : '-'}${Math.abs(Math.round(d))}`
const signUsd = (d: number): string => `US$ ${d >= 0 ? '+' : '-'}${Math.round(Math.abs(d)).toLocaleString('en-US')}`
const signPp = (d: number): string => `${d >= 0 ? '+' : '-'}${Math.abs(Math.round(d))} pp`

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

  // Denominador zero → '—'. Dizer 0% afirmaria que houve oportunidade e ela falhou; não houve base.
  const taxa = (num: number, den: number): string => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—')

  // ── 1 · O QUE FOI FEITO — ações do período, em contagem ──
  heading('O que foi feito no período')
  const acoes: [string, string][] = [
    ['Leads recebidos', String(k.newLeads)],
    ['Leads trabalhados', String(k.interagiram)],
    ['Reuniões marcadas', String(k.meetingsScheduled)],
    ['Reuniões realizadas', String(k.meetingsHeld)],
    ['Propostas enviadas', String(k.proposals)],
    ['Vendas fechadas', String(k.won)],
  ]
  autoTable(doc, {
    startY: y, body: [
      acoes.slice(0, 3).flatMap(([a, b]) => [a, b]),
      acoes.slice(3).flatMap(([a, b]) => [a, b]),
    ],
    theme: 'grid', styles: { fontSize: 9, cellPadding: 3.2 },
    columnStyles: {
      0: { textColor: GREY }, 1: { fontStyle: 'bold', textColor: DARK },
      2: { textColor: GREY }, 3: { fontStyle: 'bold', textColor: DARK },
      4: { textColor: GREY }, 5: { fontStyle: 'bold', textColor: DARK },
    },
  })
  y = afterTable(y) + 9

  // ── 2 · EFICIÊNCIA — cada degrau com a base explícita, para o número não ficar solto ──
  heading('Eficiência')
  autoTable(doc, {
    startY: y, head: [['Taxa', 'Resultado', 'Base']],
    body: [
      ['Taxa de interação', taxa(k.interagiram, k.newLeads), `${k.interagiram} de ${k.newLeads} recebidos`],
      ['Reunião marcada -> realizada', taxa(k.meetingsHeld, k.meetingsScheduled), `${k.meetingsHeld} de ${k.meetingsScheduled} marcadas`],
      ['Reunião -> venda', taxa(k.won, k.meetingsHeld), `${k.won} de ${k.meetingsHeld} realizadas`],
      ['Taxa de conversão', pct(k.conversionRate * 100), `${k.won} de ${k.newLeads} recebidos`],
    ],
    styles: { fontSize: 8.5, cellPadding: 2.4 },
    headStyles: { fillColor: GREEN, textColor: [20, 20, 20] },
    alternateRowStyles: { fillColor: [245, 247, 240] },
    columnStyles: { 1: { fontStyle: 'bold', textColor: DARK, halign: 'right' }, 2: { textColor: GREY } },
  })
  y = afterTable(y) + 9

  // ── 3 · RESULTADO — o dinheiro do período ──
  heading('Resultado')
  autoTable(doc, {
    startY: y, body: [
      ['Receita recebida', usd(exec.receitaRecebida), 'Valor fechado', usd(exec.valorFechado)],
      ['Ticket médio', usd(exec.ticketMedio), 'Receita prevista', usd(exec.receitaPrevista)],
    ],
    theme: 'grid', styles: { fontSize: 9, cellPadding: 3.2 },
    columnStyles: {
      0: { textColor: GREY }, 1: { fontStyle: 'bold', textColor: DARK },
      2: { textColor: GREY }, 3: { fontStyle: 'bold', textColor: DARK },
    },
  })
  y = afterTable(y) + 9

  // ── Comparação com o período anterior — o que mudou, sem o leitor precisar lembrar do mês passado ──
  if (cmp) {
    heading('Comparação com o período anterior')
    const cRows: [string, string, string, number][] = [
      ['Leads recebidos', String(k.newLeads), String(cmp.newLeads), k.newLeads - cmp.newLeads],
      ['Reuniões realizadas', String(k.meetingsHeld), String(cmp.meetingsHeld), k.meetingsHeld - cmp.meetingsHeld],
      ['Vendas fechadas', String(k.won), String(cmp.won), k.won - cmp.won],
    ]
    const body = cRows.map(([label, cur, prev, d]) => [label, cur, prev, signInt(d)])
    body.push(['Receita recebida', usd(exec.receitaRecebida), usd(execPrev.receitaRecebida), signUsd(exec.receitaRecebida - execPrev.receitaRecebida)])
    body.push(['Conversão', pct(k.conversionRate * 100), pct(cmp.conversionRate * 100), signPp((k.conversionRate - cmp.conversionRate) * 100)])
    const deltaVals = [...cRows.map(r => r[3]), exec.receitaRecebida - execPrev.receitaRecebida, (k.conversionRate - cmp.conversionRate) * 100]
    autoTable(doc, {
      startY: y, head: [['Métrica', 'Atual', 'Anterior', 'Diferença']],
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
    ensure(6); doc.text('Período anterior = janela imediatamente anterior, de mesma duração.', L, y); y += 8
  }

  // ── Aquisição — SÓ com investimento lançado. Sem ele, a seção inteira seria "—" repetido. ──
  if (exec.investimento > 0) {
    const usdOrDash = (v: number | null): string => (v == null ? '—' : usd(v))
    heading('Aquisição')
    autoTable(doc, {
      startY: y, body: [
        ['Investimento', usd(exec.investimento), 'Custo por lead', usdOrDash(exec.cpl)],
        ['Custo por venda', usdOrDash(exec.custoPorVenda), 'ROI', exec.roi == null ? '—' : `${exec.roi.toFixed(1)}x`],
      ],
      theme: 'grid', styles: { fontSize: 9, cellPadding: 3.2 },
      columnStyles: {
        0: { textColor: GREY }, 1: { fontStyle: 'bold', textColor: DARK },
        2: { textColor: GREY }, 3: { fontStyle: 'bold', textColor: DARK },
      },
    })
    y = afterTable(y) + 9
  }

  // ── Receita por vendedor — SÓ com mais de um. Com um vendedor a linha apenas repete o total. ──
  if (exec.receitaPorVendedor.length > 1) {
    heading('Receita por vendedor')
    autoTable(doc, {
      startY: y, head: [['Vendedor', 'Recebido', 'Clientes']],
      body: exec.receitaPorVendedor.map(sv => [sv.name, usd(sv.value), String(sv.count)]),
      styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: GREEN, textColor: [20, 20, 20] }, alternateRowStyles: { fillColor: [245, 247, 240] },
    })
    y = afterTable(y) + 9
  }

  // ── Pontos de atenção — no máximo 3; a lista inteira virava parede de texto. ──
  if (rp.insights.length > 0) {
    heading('Pontos de atenção')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
    for (const ins of rp.insights.slice(0, 3)) { ensure(7); doc.text(`• ${ins.message}`, L, y, { maxWidth: R - L }); y += 7 }
    y += 3
  }

  // ── Carteira: SNAPSHOT, não é do período. Uma linha, rotulada, no fim. ──
  ensure(14)
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

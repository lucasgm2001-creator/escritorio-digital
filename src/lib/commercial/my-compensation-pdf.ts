import { usd, brl } from '@/lib/format'
import type { MyCompensationView } from '@/server/services/MyCompensationService'

// PDF de "Minha Remuneração" (COMPENSATION-REAL-002, Parte 5). REUSA o MESMO motor (jsPDF + jspdf-autotable,
// import dinâmico), o MESMO estilo e os MESMOS formatadores (usd/brl de @/lib/format) do PDF de comissão do
// Admin (CommissionSection.gerarPdf) — não é um sistema novo de PDF. Renderiza o mês corrente do colaborador a
// partir do view-model pronto (nada é recalculado aqui).

export async function buildMyCompensationPdf(vm: MyCompensationView, workspace: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const lime: [number, number, number] = [79, 133, 0]
  const dark: [number, number, number] = [23, 35, 27]
  const cur = vm.currentMonth
  const month = vm.months[0]   // mês mais recente (corrente)
  const doc = new jsPDF()

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...lime); doc.text(workspace || 'DR Growth', 14, 18)
  doc.setFontSize(13); doc.setTextColor(...dark); doc.text('Minha Remuneração', 14, 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90)
  doc.text(`Colaborador: ${vm.sellerName}`, 14, 34)
  doc.text(`Cargo: ${vm.cargo ?? '—'}${vm.department ? ` · ${vm.department}` : ''}`, 14, 39)
  doc.text(`Mês de referência: ${month?.label ?? '—'}`, 14, 44)

  doc.setDrawColor(...lime); doc.setLineWidth(0.5); doc.line(14, 49, 196, 49)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...dark); doc.text('TOTAL DO MÊS', 14, 58)
  doc.setFontSize(17); doc.setTextColor(...lime); doc.text(usd(cur?.totalUsd ?? 0), 14, 67)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark)
  doc.text(`Salário: ${usd(cur?.salaryUsd ?? 0)}    Reuniões (${cur?.meetingsCount ?? 0}): ${usd(cur?.meetingsUsd ?? 0)}    Comissão (${cur?.weeksCount ?? 0} sem.): ${usd(cur?.weeksUsd ?? 0)}`, 14, 75)
  doc.setTextColor(90, 90, 90)
  doc.text(`Próximo pagamento: ${vm.nextPayout?.date ?? '—'}  ·  saldo previsto ${usd(vm.nextPayout?.totalUsd ?? 0)}`, 14, 81)

  const rows = (month?.payments ?? []).map(p => [p.data, p.origem, p.cliente ?? '—', usd(p.valorUsd), p.valorBrl > 0 ? brl(p.valorBrl) : '—'])
  autoTable(doc, {
    startY: 88,
    head: [['Data', 'Origem', 'Cliente', 'USD', 'BRL']],
    body: rows.length ? rows : [['—', 'Sem lançamentos no mês', '—', usd(0), '—']],
    foot: [['', '', 'Total', usd(cur?.totalUsd ?? 0), cur && cur.totalBrl > 0 ? brl(cur.totalBrl) : '—']],
    theme: 'striped',
    headStyles: { fillColor: lime, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 244, 238], textColor: dark, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(9); doc.setTextColor(120, 120, 120)
  doc.text('Valores em USD (moeda base); BRL pela cotação congelada da data. Histórico imutável — nada recalculado.', 14, finalY)
  doc.save(`minha-remuneracao-${month?.key ?? 'atual'}.pdf`)
}

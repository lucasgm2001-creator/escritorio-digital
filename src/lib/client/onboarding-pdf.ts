import type { OnboardingStatus } from '@/lib/client/onboarding'

// PDF do ONBOARDING (ONBOARDING-002) — o entregável da reunião para a equipe que vai tocar o projeto.
// Consome o que já está na tela; não lê banco nem recalcula nada, então papel e tela não podem divergir.
//
// Etapa PENDENTE aparece em destaque e agrupada no fim: para quem recebe, o que ficou em aberto é mais
// acionável do que o que já foi resolvido. Etapa sem desfecho sai como "não tratada" em vez de sumir —
// omitir daria a impressão de roteiro completo.

const VERDE: [number, number, number] = [101, 163, 13]
const ESCURO: [number, number, number] = [25, 25, 25]
const CINZA: [number, number, number] = [110, 110, 110]
const AMBAR: [number, number, number] = [180, 120, 10]
const L = 14
const R = 196

export type OnboardingPdfItem = {
  titulo: string
  status: OnboardingStatus | null
  resposta: string | null
}

export async function buildOnboardingPdf(input: { clientName: string; itens: OnboardingPdfItem[] }): Promise<void> {
  const { clientName, itens } = input
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const geradoEm = new Date().toLocaleDateString('pt-BR')

  let y = 0
  const garante = (precisa: number) => { if (y + precisa > 278) { doc.addPage(); y = 22 } }

  doc.setFillColor(...VERDE); doc.rect(0, 0, 210, 5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...VERDE)
  doc.text('Escritório Digital', L, 20)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...ESCURO)
  doc.text('Onboarding do cliente', L, 33)
  doc.setDrawColor(...VERDE); doc.setLineWidth(1); doc.line(L, 38, L + 55, 38)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...ESCURO)
  doc.text(clientName, L, 48)
  doc.setFontSize(9); doc.setTextColor(...CINZA)
  doc.text(`Gerado em ${geradoEm}`, L, 54)

  const concluidas = itens.filter(i => i.status === 'concluido')
  const pendentes = itens.filter(i => i.status === 'pendente')
  const naoTratadas = itens.filter(i => i.status == null)

  y = 66
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA)
  doc.text(`${concluidas.length} concluída(s) · ${pendentes.length} pendente(s) · ${naoTratadas.length} não tratada(s)`, L, y)
  y += 10

  const titulo = (texto: string, cor: [number, number, number]) => {
    garante(16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...cor)
    doc.text(texto, L, y)
    doc.setDrawColor(...cor); doc.setLineWidth(0.5); doc.line(L, y + 2, L + 18, y + 2)
    y += 9
  }

  const bloco = (lista: OnboardingPdfItem[], cor: [number, number, number]) => {
    for (const item of lista) {
      garante(14)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ESCURO)
      doc.text(`• ${item.titulo}`, L, y); y += 5.5
      if (item.resposta) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...cor)
        const linhas = doc.splitTextToSize(item.resposta, R - L - 4) as string[]
        for (const linha of linhas) { garante(6); doc.text(linha, L + 4, y); y += 5 }
      }
      y += 2.5
    }
    y += 4
  }

  // Pendências primeiro: é o que a equipe precisa resolver.
  if (pendentes.length) { titulo('Pendências', AMBAR); bloco(pendentes, AMBAR) }
  if (concluidas.length) { titulo('Definido na reunião', VERDE); bloco(concluidas, CINZA) }
  if (naoTratadas.length) {
    titulo('Não tratadas', CINZA)
    for (const item of naoTratadas) {
      garante(7)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA)
      doc.text(`• ${item.titulo}`, L, y); y += 5.5
    }
  }

  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(226, 226, 226); doc.setLineWidth(0.3); doc.line(L, 288, R, 288)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA)
    doc.text(`Onboarding · ${clientName}`, L, 293)
    doc.text(`Página ${p} de ${paginas}`, R, 293, { align: 'right' })
  }

  doc.save(`onboarding-${clientName.replace(/[^0-9a-zA-Z]+/g, '-').toLowerCase()}.pdf`)
}

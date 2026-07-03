import { NextResponse } from 'next/server'

// STUB de TESTE de entrada (INBOUND-001, Part 4) — não implementado. Não grava, não cria lead, não valida
// payload real. 501 até o provider ser ativado com autorização/chave/mapeamento.
export async function POST(_req: Request, { params }: { params: { provider: string } }) {
  return NextResponse.json(
    { error: 'not_implemented', provider: params.provider, message: 'Teste de entrada não ativado (INBOUND-001).' },
    { status: 501 },
  )
}

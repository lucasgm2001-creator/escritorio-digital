import { NextResponse } from 'next/server'

// STUB de REPLAY de entrada (INBOUND-001, Part 4) — não implementado. Não reprocessa, não grava, não cria
// lead. 501 até haver logs reais + autorização. Reprocessar uma entrega antiga é operação privilegiada futura.
export async function POST(_req: Request, props: { params: Promise<{ provider: string }> }) {
  const params = await props.params;
  return NextResponse.json(
    { error: 'not_implemented', provider: params.provider, message: 'Replay de entrada não ativado (INBOUND-001).' },
    { status: 501 },
  )
}
